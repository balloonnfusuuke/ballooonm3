
import React, { useState, useEffect } from 'react';
import { PlateAppearance, GameBatchRecord, BatterStats, PitcherStats, Player, Opponent } from '../types';
import { getPARecords, getBatchRecords, getPitcherRecords, exportUnifiedCSV, getPlayers, getOpponents } from '../services/dataService';
import { calculateBatterStats, calculatePitcherStats, calculateLeagueStats, formatStat } from '../services/statsService';
import { Download, BarChart2, TrendingUp, RefreshCw, User, Target, MapPin, Calendar, Activity, Info, Filter, Shield, Swords, Crown, Medal, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { MetricsGuideModal } from './MetricsGuideModal';

type DateRange = 'all' | 'month' | 'week';
type TrendMetric = 'avg' | 'ops' | 'era' | 'whip';
type AnalysisMode = 'team' | 'scouting';

export const Dashboard: React.FC = () => {
  const [mode, setMode] = useState<AnalysisMode>('team');
  const [view, setView] = useState<'batter' | 'pitcher'>('batter');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  
  // Data State
  const [batterStats, setBatterStats] = useState<BatterStats[]>([]);
  const [pitcherStats, setPitcherStats] = useState<PitcherStats[]>([]);
  const [teamBatterTotal, setTeamBatterTotal] = useState<BatterStats | null>(null);
  const [teamPitcherTotal, setTeamPitcherTotal] = useState<PitcherStats | null>(null);
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  
  // Selection State
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('ALL'); // 'ALL' or UUID
  const [selectedOpponent, setSelectedOpponent] = useState<string>(''); // Opponent Name
  
  // Spray Chart Data
  const [sprayData, setSprayData] = useState<Array<{x: number, y: number, result: string, isHit: boolean}>>([]);
  const [pitcherSprayData, setPitcherSprayData] = useState<Array<{x: number, y: number, result: string, isOut: boolean}>>([]);

  // Trend State
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('avg');
  const [trendData, setTrendData] = useState<any[]>([]);

  // Modal State
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const opps = getOpponents();
    setOpponents(opps);
    if(opps.length > 0 && !selectedOpponent) setSelectedOpponent(opps[0].name);
    loadData();
  }, [dateRange, mode, selectedOpponent]);

  // Effect: When Stats or Selected Player changes, update Charts (Spray & Trend)
  useEffect(() => {
      updateCharts();
  }, [selectedPlayerId, batterStats, pitcherStats, view, trendMetric]);

  const getDateCutoff = () => {
      if (mode === 'scouting') return null; // Scouting always uses all-time data for sample size
      const now = new Date();
      if (dateRange === 'week') {
          now.setDate(now.getDate() - 7);
          return now;
      }
      if (dateRange === 'month') {
          now.setMonth(now.getMonth() - 1);
          return now;
      }
      return null; // All time
  };

  const loadData = () => {
    const cutoff = getDateCutoff();
    const currentPlayers = getPlayers();
    setActivePlayers(currentPlayers);

    // --- BATTERS ---
    const allPLive = getPARecords();
    const allPBatch = getBatchRecords();

    let pLive = allPLive;
    let pBatch = allPBatch;

    // Filter by Date (Team Mode) or Opponent (Scouting Mode)
    if (mode === 'team') {
        if (cutoff) {
            pLive = pLive.filter(r => new Date(r.date) >= cutoff);
            pBatch = pBatch.filter(r => new Date(r.date) >= cutoff);
        }
    } else {
        if (selectedOpponent) {
            pLive = pLive.filter(r => r.opponent === selectedOpponent);
            pBatch = pBatch.filter(r => r.opponent === selectedOpponent);
        } else {
            pLive = []; pBatch = [];
        }
    }

    const finalBStats: BatterStats[] = [];
    const tempStatsForLeague: BatterStats[] = [];

    // Calculate Individual Stats
    currentPlayers.filter(p => p.type !== 'pitcher').forEach(p => {
        const pRecs = pLive.filter(r => r.playerId === p.id && r.opponent !== 'My Team');
        const bRecs = pBatch.filter(r => r.playerId === p.id);
        
        // In Scouting mode, only include players with stats against this opponent
        if (mode === 'scouting' && pRecs.length === 0 && bRecs.length === 0) return;
        
        const s = calculateBatterStats(pRecs, bRecs);
        tempStatsForLeague.push(s);
    });

    // Calculate League (Team) Totals for Context
    let l_pa=0, l_rc=0, l_xr=0, l_runs=0;
    tempStatsForLeague.forEach(b => { l_pa+=b.pa; l_rc+=b.rc; l_xr+=b.xr; l_runs+=b.r; });
    const lgBatterStats = { totalPA: l_pa, totalRC: l_rc, totalXR: l_xr, totalRuns: l_runs, totalInnings: l_pa/4.2 };

    // Re-calculate with League Context (RCAA etc) & Create Total Object
    let totalB = calculateBatterStats([], [], lgBatterStats); // Initialize empty
    totalB.name = "チーム合計";
    
    tempStatsForLeague.forEach(pStats => {
        const pRecs = pLive.filter(r => r.playerId === pStats.playerId && r.opponent !== 'My Team');
        const bRecs = pBatch.filter(r => r.playerId === pStats.playerId);
        const finalS = calculateBatterStats(pRecs, bRecs, lgBatterStats);
        finalBStats.push(finalS);
    });
    
    // Calculate Team Total manually by summing counting stats
    if (finalBStats.length > 0) {
        // Pseudo-aggregate records
        const allLiveFiltered = pLive.filter(r => r.opponent !== 'My Team');
        const allBatchFiltered = pBatch;
        totalB = calculateBatterStats(allLiveFiltered, allBatchFiltered, lgBatterStats);
        totalB.name = "チーム合計";
    }

    setBatterStats(finalBStats.sort((a,b) => b.ops - a.ops));
    setTeamBatterTotal(totalB);

    // --- PITCHERS ---
    const allPRecords = getPitcherRecords(); 
    let pRecords = allPRecords;

    if (mode === 'team') {
        if (cutoff) pRecords = pRecords.filter(r => new Date(r.date) >= cutoff);
    } else {
        if (selectedOpponent) pRecords = pRecords.filter(r => r.opponent === selectedOpponent);
        else pRecords = [];
    }

    const leagueStats = calculateLeagueStats(pRecords); 

    const finalPStats: PitcherStats[] = [];
    currentPlayers.filter(p => p.type !== 'batter').forEach(p => {
        const batchRecs = pRecords.filter(r => r.playerId === p.id);
        const stats = calculatePitcherStats(batchRecs, leagueStats);
        if (stats.games > 0) {
            finalPStats.push(stats);
        }
    });

    // Team Pitching Total
    let totalP: PitcherStats | null = null;
    if (pRecords.length > 0) {
        totalP = calculatePitcherStats(pRecords, leagueStats);
        totalP.name = "チーム合計";
    }

    setPitcherStats(finalPStats.sort((a,b) => {
        if (a.era === 0 && a.outs > 0) return -1;
        if (b.era === 0 && b.outs > 0) return 1;
        if (a.era === 0 && a.outs === 0) return 1;
        return a.era - b.era;
    }));
    setTeamPitcherTotal(totalP);
  };

  const updateCharts = () => {
      // 1. Update Spray Charts
      if (view === 'batter') {
          let sprays: Array<{x: number, y: number, result: string, isHit: boolean}> = [];
          
          if (selectedPlayerId === 'ALL') {
              // Aggregate all players
              batterStats.forEach(s => {
                  s.spray_data.forEach(d => {
                      const isHit = ['1B','2B','3B','HR'].includes(d.result);
                      sprays.push({ x: d.x, y: d.y, result: d.result, isHit });
                  });
              });
          } else {
              // Single Player
              const p = batterStats.find(s => s.playerId === selectedPlayerId);
              if (p && p.spray_data) {
                  sprays = p.spray_data.map(d => ({
                      x: d.x, y: d.y, result: d.result, 
                      isHit: ['1B','2B','3B','HR'].includes(d.result)
                  }));
              }
          }
          setSprayData(sprays);
      } else {
          // Pitcher View
          let sprays: Array<{x: number, y: number, result: string, isOut: boolean}> = [];
          if (selectedPlayerId === 'ALL') {
              pitcherStats.forEach(s => {
                  s.spray_data.forEach(d => {
                      const isOut = ['GO','FO','SO','SAC','SF','GIDP'].includes(d.result);
                      sprays.push({ x: d.x, y: d.y, result: d.result, isOut });
                  });
              });
          } else {
              const p = pitcherStats.find(s => s.playerId === selectedPlayerId);
              if (p && p.spray_data) {
                  sprays = p.spray_data.map(d => ({
                      x: d.x, y: d.y, result: d.result,
                      isOut: ['GO','FO','SO','SAC','SF','GIDP'].includes(d.result)
                  }));
              }
          }
          setPitcherSprayData(sprays);
      }

      // 2. Update Trend Data
      const targetId = selectedPlayerId === 'ALL' 
          ? (view === 'batter' ? batterStats[0]?.playerId : pitcherStats[0]?.playerId) 
          : selectedPlayerId;
      
      if (targetId) {
          calculateTrends(targetId);
      } else {
          setTrendData([]);
      }
  };

  const calculateTrends = (playerId: string) => {
      const cutoff = getDateCutoff();
      const chartData: any[] = [];
      
      if (view === 'batter') {
          let allLive = getPARecords().filter(r => r.playerId === playerId && r.opponent !== 'My Team');
          let allBatch = getBatchRecords().filter(r => r.playerId === playerId);
          
          if (mode === 'scouting' && selectedOpponent) {
              allLive = allLive.filter(r => r.opponent === selectedOpponent);
              allBatch = allBatch.filter(r => r.opponent === selectedOpponent);
          }

          const events = [
              ...allLive.map(r => ({ date: r.date, type: 'live', data: r })),
              ...allBatch.map(r => ({ date: r.date, type: 'batch', data: r }))
          ].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          let accH = 0, accAB = 0, accBB = 0, accHBP = 0, accSF = 0, accTB = 0;

          events.forEach(e => {
              if (cutoff && new Date(e.date) < cutoff) return; 

              let h=0, ab=0, bb=0, hbp=0, sf=0, tb=0;
              if (e.type === 'live') {
                  const r = e.data as PlateAppearance;
                  if (['1B','2B','3B','HR','SO','GO','FO','ROE','FC','GIDP'].includes(r.result)) ab=1;
                  if (['1B','2B','3B','HR'].includes(r.result)) h=1;
                  if (r.result==='1B') tb=1;
                  if (r.result==='2B') tb=2;
                  if (r.result==='3B') tb=3;
                  if (r.result==='HR') tb=4;
                  if (r.result==='BB'||r.result==='IBB') bb=1;
                  if (r.result==='HBP') hbp=1;
                  if (r.result==='SF') sf=1;
              } else {
                  const r = e.data as GameBatchRecord;
                  ab=r.ab; h=r.h; bb=r.bb+(r.ibb||0); hbp=r.hbp; sf=r.sf;
                  const singles = r.h - (r.double+r.triple+r.hr);
                  tb = singles + r.double*2 + r.triple*3 + r.hr*4;
              }
              
              accH += h; accAB += ab; accBB += bb; accHBP += hbp; accSF += sf; accTB += tb;
              
              let val = 0;
              if (trendMetric === 'avg') val = accAB > 0 ? accH / accAB : 0;
              if (trendMetric === 'ops') {
                  const obp = (accAB+accBB+accHBP+accSF) > 0 ? (accH+accBB+accHBP)/(accAB+accBB+accHBP+accSF) : 0;
                  const slg = accAB > 0 ? accTB / accAB : 0;
                  val = obp + slg;
              }

              const existing = chartData.find(c => c.date === e.date);
              if (existing) {
                  existing.value = val;
              } else {
                  chartData.push({ date: e.date.substring(5), fullDate: e.date, value: val });
              }
          });
      } else {
          let allRecs = getPitcherRecords().filter(r => r.playerId === playerId);
          
          if (mode === 'scouting' && selectedOpponent) {
              allRecs = allRecs.filter(r => r.opponent === selectedOpponent);
          }
          
          allRecs = allRecs.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          let accER = 0, accIP = 0, accH = 0, accBB = 0;

          allRecs.forEach(r => {
             if (cutoff && new Date(r.date) < cutoff) return;

             accER += r.er;
             accIP += (Math.floor(r.outs/3) + (r.outs%3)/3);
             accH += r.h;
             accBB += r.bb + (r.ibb||0) + r.hbp;

             let val = 0;
             if (trendMetric === 'era') val = accIP > 0 ? (accER * 9) / accIP : 0;
             if (trendMetric === 'whip') val = accIP > 0 ? (accH + accBB) / accIP : 0;

             chartData.push({ date: r.date.substring(5), fullDate: r.date, value: val });
          });
      }
      setTrendData(chartData);
  };

  const getOpsColor = (ops: number) => {
    if (ops >= 1.000) return 'text-red-600 font-extrabold';
    if (ops >= 0.800) return 'text-team-red font-bold';
    return 'text-slate-900';
  };

  // Find Leaders
  const getQualifiedLeader = (stats: BatterStats[], key: keyof BatterStats, minPaPercent: number = 0.3) => {
      if (stats.length === 0) return null;
      const maxPa = Math.max(...stats.map(s => s.pa));
      const threshold = Math.max(1, maxPa * minPaPercent); // Min 1 to show something
      const qualified = stats.filter(s => s.pa >= threshold);
      if (qualified.length === 0) return stats[0];
      return qualified.sort((a,b) => (b[key] as number) - (a[key] as number))[0];
  };

  // Sabermetrics MVP: Best RCWIN (Batter) / RSWIN (Pitcher)
  const getSaberMvpBatter = () => {
      if (batterStats.length === 0) return null;
      return [...batterStats].sort((a,b) => b.rcwin - a.rcwin)[0];
  };
  const getSaberMvpPitcher = () => {
      if (pitcherStats.length === 0) return null;
      return [...pitcherStats].sort((a,b) => b.rswin - a.rswin)[0];
  };

  const saberMvpB = getSaberMvpBatter();
  const saberMvpP = getSaberMvpPitcher();

  // For Scouting Mode - Find Killer Players
  const getKillerBatter = () => {
      if (batterStats.length === 0) return null;
      return [...batterStats].sort((a, b) => b.ops - a.ops)[0];
  };
  
  const getKillerPitcher = () => {
      if (pitcherStats.length === 0) return null;
      return [...pitcherStats].sort((a, b) => a.era - b.era)[0]; // Lower is better
  };

  const bestAvg = getQualifiedLeader(batterStats, 'avg');
  const mostHr = getQualifiedLeader(batterStats, 'hr', 0);
  const killerB = getKillerBatter();

  const getCurrentPlayerName = () => {
      if (selectedPlayerId === 'ALL') return 'チーム全体';
      const p = view === 'batter' 
        ? batterStats.find(s => s.playerId === selectedPlayerId)
        : pitcherStats.find(s => s.playerId === selectedPlayerId);
      return p ? p.name : '選択なし';
  };

  return (
    <div className="space-y-6 max-w-[95%] mx-auto pb-20">
      
      {/* Dashboard Header & Mode Switch */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-team-navy flex items-center gap-2">
                  {mode === 'team' ? <BarChart2 size={28}/> : <Swords size={28}/>}
                  {mode === 'team' ? 'チーム成績ダッシュボード' : '対戦相手スカウティング'}
              </h2>
              <p className="text-slate-500 text-sm">{mode === 'team' ? '全試合のデータを集計・分析' : '特定の相手との相性を分析'}</p>
            </div>
            
            <div className="flex items-center gap-2">
                <button onClick={() => setGuideOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-bold text-xs transition">
                    <BookOpen size={16}/> 指標ガイド
                </button>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setMode('team')} className={`px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-2 ${mode==='team' ? 'bg-white shadow text-team-navy' : 'text-slate-400'}`}>
                        <BarChart2 size={16}/> チーム分析
                    </button>
                    <button onClick={() => setMode('scouting')} className={`px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-2 ${mode==='scouting' ? 'bg-white shadow text-red-700' : 'text-slate-400'}`}>
                        <Swords size={16}/> 対戦分析
                    </button>
                </div>
            </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-3 mt-4 justify-between items-center border-t pt-4">
            {mode === 'team' ? (
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setDateRange('all')} className={`px-3 py-1 text-xs font-bold rounded transition ${dateRange==='all' ? 'bg-white shadow text-team-navy' : 'text-slate-400'}`}>全期間</button>
                    <button onClick={() => setDateRange('month')} className={`px-3 py-1 text-xs font-bold rounded transition ${dateRange==='month' ? 'bg-white shadow text-team-navy' : 'text-slate-400'}`}>月間</button>
                    <button onClick={() => setDateRange('week')} className={`px-3 py-1 text-xs font-bold rounded transition ${dateRange==='week' ? 'bg-white shadow text-team-navy' : 'text-slate-400'}`}>週間</button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <Shield size={20} className="text-red-600"/>
                    <span className="font-bold text-sm text-slate-600">対戦相手:</span>
                    <select 
                        value={selectedOpponent} 
                        onChange={(e) => setSelectedOpponent(e.target.value)}
                        className="p-2 border rounded-lg font-bold text-slate-800 bg-red-50 focus:bg-white"
                    >
                        {opponents.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                    </select>
                </div>
            )}

            <div className="flex gap-2">
                <button onClick={loadData} className="p-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200 transition">
                    <RefreshCw size={20} />
                </button>
                <button 
                    onClick={() => exportUnifiedCSV(batterStats, pitcherStats)}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-green-700 transition text-sm"
                >
                    <Download size={16} />
                    CSV出力
                </button>
            </div>
        </div>
      </div>

      {/* Global Filter & View Toggle */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
          <div className="flex gap-2">
              <button onClick={() => { setView('batter'); setSelectedPlayerId('ALL'); setTrendMetric('avg'); }} className={`px-6 py-2 rounded-t-lg font-bold text-sm transition ${view==='batter' ? 'bg-white text-blue-700 shadow-sm' : 'bg-slate-200 text-slate-500'}`}>
                  <span className="flex items-center gap-2"><User size={16}/> 野手成績</span>
              </button>
              <button onClick={() => { setView('pitcher'); setSelectedPlayerId('ALL'); setTrendMetric('era'); }} className={`px-6 py-2 rounded-t-lg font-bold text-sm transition ${view==='pitcher' ? 'bg-white text-red-700 shadow-sm' : 'bg-slate-200 text-slate-500'}`}>
                  <span className="flex items-center gap-2"><Target size={16}/> 投手成績</span>
              </button>
          </div>
          
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border mb-2 md:mb-0">
              <Filter size={16} className="text-slate-400"/>
              <span className="text-xs font-bold text-slate-500">チャート対象:</span>
              <select 
                  className="p-1 border rounded text-sm font-bold bg-slate-50 min-w-[150px]"
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
              >
                  <option value="ALL">チーム全体</option>
                  {view === 'batter' 
                    ? batterStats.map(p => <option key={p.playerId} value={p.playerId}>{p.name}</option>)
                    : pitcherStats.map(p => <option key={p.playerId} value={p.playerId}>{p.name}</option>)
                  }
              </select>
          </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
          
          {/* --- BATTER VIEW --- */}
          {view === 'batter' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                  {/* Top Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-1 h-64 border rounded-xl p-4">
                          <h4 className="font-bold text-slate-500 mb-2 flex items-center gap-2">
                              <TrendingUp size={16}/> 
                              {mode === 'team' ? 'OPS Leaders' : 'VS 相性OPS'}
                          </h4>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={batterStats.slice(0, 5)} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{fontSize:12}} />
                                <Tooltip />
                                <Bar dataKey="ops" radius={[0, 4, 4, 0]}>
                                    {batterStats.slice(0,5).map((e,i)=><Cell key={i} fill={e.ops>=0.8?'#ef4444':'#3b82f6'}/>)}
                                </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                      </div>

                      {/* Spray Chart Visualization */}
                      <div className="lg:col-span-1 h-64 border rounded-xl p-4 flex flex-col items-center relative">
                           <h4 className="font-bold text-slate-500 mb-2 flex items-center gap-2 w-full">
                               <MapPin size={16}/> 
                               <span>打球傾向: {getCurrentPlayerName()}</span>
                           </h4>
                           <div className="relative w-48 h-48 bg-green-700 rounded-lg shadow-inner overflow-hidden">
                                  <svg width="100%" height="100%" viewBox="0 0 100 100">
                                      {/* Field Background */}
                                      <rect width="100" height="100" fill="#15803d" />
                                      <line x1="50" y1="85" x2="0" y2="35" stroke="white" strokeWidth="0.5" />
                                      <line x1="50" y1="85" x2="100" y2="35" stroke="white" strokeWidth="0.5" />
                                      <path d="M 50 85 L 75 60 L 50 35 L 25 60 Z" fill="#a36936" opacity="0.8" />
                                      <path d="M 0 35 Q 50 -10 100 35" stroke="white" strokeWidth="0.5" fill="none" />
                                      
                                      {/* Data Points */}
                                      {sprayData.map((d, i) => (
                                          <circle key={i} cx={d.x} cy={d.y} r="2" fill={d.isHit ? '#ef4444' : '#22d3ee'} stroke={d.isHit ? 'white' : 'blue'} strokeWidth="0.5" opacity="0.9" />
                                      ))}
                                  </svg>
                           </div>
                           <div className="flex gap-4 mt-2 text-xs font-bold text-slate-600">
                               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/> 安打 ({sprayData.filter(s=>s.isHit).length})</div>
                               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-400 border border-blue-600"/> アウト ({sprayData.filter(s=>!s.isHit).length})</div>
                           </div>
                      </div>
                      
                      {/* Summary Cards (MVP) */}
                      <div className="lg:col-span-1 flex flex-col gap-4">
                          {mode === 'team' ? (
                              <>
                                  <div className="flex-1 bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-xl border border-yellow-200 relative overflow-hidden shadow-sm">
                                      <Medal size={48} className="absolute -right-2 -bottom-2 text-yellow-300 rotate-12"/>
                                      <div className="text-xs text-yellow-700 font-bold mb-1 uppercase tracking-wider">Sabermetrics MVP (野手)</div>
                                      <div className="text-xl font-bold text-slate-900">{saberMvpB?.name || '---'}</div>
                                      <div className="text-xs text-slate-600 mt-1 font-mono">RCWIN: {saberMvpB?.rcwin.toFixed(2)} / OPS: {saberMvpB?.ops.toFixed(3)}</div>
                                  </div>
                                  <div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 p-4 rounded-xl border border-blue-200 relative overflow-hidden shadow-sm">
                                      <Crown size={48} className="absolute -right-2 -bottom-2 text-blue-200 rotate-12"/>
                                      <div className="text-xs text-blue-700 font-bold mb-1 uppercase tracking-wider">Sabermetrics MVP (投手)</div>
                                      <div className="text-xl font-bold text-slate-900">{saberMvpP?.name || '---'}</div>
                                      <div className="text-xs text-slate-600 mt-1 font-mono">RSWIN: {saberMvpP?.rswin.toFixed(2)} / ERA: {saberMvpP?.era.toFixed(2)}</div>
                                  </div>
                              </>
                          ) : (
                              /* Scouting Mode Cards */
                              <>
                                  <div className="bg-red-50 p-4 rounded-xl flex flex-col justify-center border border-red-100 relative overflow-hidden">
                                      <Crown size={64} className="absolute -right-4 -bottom-4 text-red-200/50 rotate-12"/>
                                      <div className="text-xs text-red-600 font-bold mb-1">{selectedOpponent} キラー</div>
                                      <div className="text-xl font-bold text-red-900 line-clamp-1">{killerB?.name || 'データなし'}</div>
                                      <div className="text-xs text-slate-600 mt-1">OPS: {killerB?.ops.toFixed(3)} / Avg: {killerB?.avg.toFixed(3)}</div>
                                  </div>
                                  <div className="bg-slate-100 p-4 rounded-xl flex flex-col justify-center border border-slate-200">
                                      <div className="text-xs text-slate-500 font-bold mb-1">対戦試合数</div>
                                      <div className="text-3xl font-bold text-slate-800">{killerB?.games || 0}</div>
                                      <div className="text-xs text-slate-400 mt-1">Games</div>
                                  </div>
                              </>
                          )}
                      </div>
                  </div>

                  {/* Trend Analysis Section */}
                  <div className="border rounded-xl p-6 bg-slate-50/50">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                          <h3 className="font-bold text-slate-700 flex items-center gap-2">
                              <Activity size={20} /> 
                              <span>トレンド分析: {getCurrentPlayerName()}</span>
                          </h3>
                          {selectedPlayerId === 'ALL' && <span className="text-xs text-slate-400">※ 全体選択時はチーム代表者(リスト最上位)を表示</span>}
                          <div className="flex gap-2">
                              <select 
                                  className="p-2 border rounded text-sm font-bold bg-white"
                                  value={trendMetric}
                                  onChange={(e) => setTrendMetric(e.target.value as any)}
                              >
                                  <option value="avg">打率推移</option>
                                  <option value="ops">OPS推移</option>
                              </select>
                          </div>
                      </div>
                      <div className="h-64 w-full bg-white rounded-lg border p-2">
                          {trendData.length > 1 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={trendData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                      <XAxis dataKey="date" tick={{fontSize: 10}} />
                                      <YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} />
                                      <Tooltip labelStyle={{color:'black'}} />
                                      <Line type="monotone" dataKey="value" stroke="#0f172a" strokeWidth={2} dot={{r:3}} activeDot={{r:5}} />
                                  </LineChart>
                              </ResponsiveContainer>
                          ) : (
                              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                  データ不足のためグラフを表示できません
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Main Table */}
                  <div className="overflow-x-auto border rounded-xl shadow-inner bg-white">
                      <table className="w-full text-xs text-left whitespace-nowrap">
                          <thead className="bg-slate-100 text-slate-600 font-bold border-b-2 border-slate-200">
                              <tr>
                                  <th className="px-3 py-4 sticky left-0 bg-slate-100 z-10 border-r min-w-[120px]">選手名</th>
                                  {/* Standard */}
                                  <th className="px-2 py-4 bg-blue-50 text-center text-blue-800">OPS</th>
                                  <th className="px-2 py-4 text-center">打率</th>
                                  <th className="px-2 py-4 text-center">本塁打</th>
                                  <th className="px-2 py-4 text-center">打点</th>
                                  <th className="px-2 py-4 text-center">得点</th>
                                  <th className="px-2 py-4 text-center">盗塁</th>
                                  <th className="px-2 py-4 text-center bg-yellow-50 border-x">打席</th>
                                  
                                  {/* Counts */}
                                  <th className="px-2 py-4 text-center">安打</th>
                                  <th className="px-2 py-4 text-center">四球</th>
                                  <th className="px-2 py-4 text-center">死球</th>
                                  <th className="px-2 py-4 text-center">三振</th>
                                  <th className="px-2 py-4 text-center">併殺</th>
                                  
                                  {/* Adv Rates */}
                                  <th className="px-2 py-4 text-center bg-slate-200/50">得点圏</th>
                                  <th className="px-2 py-4 text-center bg-slate-200/50">出塁率</th>
                                  <th className="px-2 py-4 text-center bg-slate-200/50">長打率</th>
                                  <th className="px-2 py-4 text-center bg-slate-200/50">IsoD</th>
                                  <th className="px-2 py-4 text-center bg-slate-200/50">IsoP</th>
                                  <th className="px-2 py-4 text-center bg-slate-200/50">BB/K</th>

                                  {/* Saber 1 */}
                                  <th className="px-2 py-4 text-center border-l">RC27</th>
                                  <th className="px-2 py-4 text-center">XR27</th>
                                  <th className="px-2 py-4 text-center">SecA</th>
                                  <th className="px-2 py-4 text-center">TA</th>
                                  <th className="px-2 py-4 text-center">PS</th>
                                  <th className="px-2 py-4 text-center" title="インプレー打率: (安打-本塁打)/(打数-三振-本塁打+犠飛)">BABIP</th>
                                  
                                  {/* Relative */}
                                  <th className="px-2 py-4 text-center border-l bg-green-50">RCAA</th>
                                  <th className="px-2 py-4 text-center bg-green-50">XR+</th>
                                  <th className="px-2 py-4 text-center bg-green-50">RCWIN</th>

                                  {/* Direction */}
                                  <th className="px-2 py-4 text-center border-l">左打</th>
                                  <th className="px-2 py-4 text-center">中打</th>
                                  <th className="px-2 py-4 text-center">右打</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {batterStats.map(s => (
                                  <tr key={s.playerId} className="hover:bg-slate-50 transition h-10">
                                      <td className="px-3 py-2 sticky left-0 bg-white border-r font-bold text-slate-800">{s.name}</td>
                                      
                                      <td className={`px-2 py-2 text-center font-mono font-bold ${getOpsColor(s.ops)} bg-blue-50/50`}>{formatStat(s.ops)}</td>
                                      <td className="px-2 py-2 text-center font-mono">{formatStat(s.avg)}</td>
                                      <td className="px-2 py-2 text-center font-mono">{s.hr}</td>
                                      <td className="px-2 py-2 text-center font-mono">{s.rbi}</td>
                                      <td className="px-2 py-2 text-center font-mono">{s.r}</td>
                                      <td className="px-2 py-2 text-center font-mono">{s.sb}</td>
                                      <td className="px-2 py-2 text-center font-mono bg-yellow-50/50 border-x font-bold">{s.pa}</td>

                                      <td className="px-2 py-2 text-center font-mono">{s.h}</td>
                                      <td className="px-2 py-2 text-center font-mono">{s.bb}</td>
                                      <td className="px-2 py-2 text-center font-mono">{s.hbp}</td>
                                      <td className="px-2 py-2 text-center font-mono">{s.so}</td>
                                      <td className="px-2 py-2 text-center font-mono">{s.gidp}</td>

                                      <td className="px-2 py-2 text-center font-mono bg-slate-100/30">{formatStat(s.risp_avg)}</td>
                                      <td className="px-2 py-2 text-center font-mono bg-slate-100/30">{formatStat(s.obp)}</td>
                                      <td className="px-2 py-2 text-center font-mono bg-slate-100/30">{formatStat(s.slg)}</td>
                                      <td className="px-2 py-2 text-center font-mono bg-slate-100/30">{formatStat(s.iso_d)}</td>
                                      <td className="px-2 py-2 text-center font-mono bg-slate-100/30">{formatStat(s.iso_p)}</td>
                                      <td className="px-2 py-2 text-center font-mono bg-slate-100/30">{s.bb_k.toFixed(2)}</td>
                                      
                                      <td className="px-2 py-2 text-center font-mono border-l">{formatStat(s.rc27, 2)}</td>
                                      <td className="px-2 py-2 text-center font-mono">{formatStat(s.xr27, 2)}</td>
                                      <td className="px-2 py-2 text-center font-mono">{formatStat(s.sec_a)}</td>
                                      <td className="px-2 py-2 text-center font-mono">{formatStat(s.ta)}</td>
                                      <td className="px-2 py-2 text-center font-mono">{formatStat(s.ps, 2)}</td>
                                      <td className="px-2 py-2 text-center font-mono font-bold text-slate-600">{formatStat(s.babip)}</td>

                                      <td className="px-2 py-2 text-center font-mono border-l bg-green-50/30">{s.rcaa.toFixed(1)}</td>
                                      <td className="px-2 py-2 text-center font-mono bg-green-50/30">{s.xr_plus.toFixed(1)}</td>
                                      <td className="px-2 py-2 text-center font-mono bg-green-50/30">{s.rcwin.toFixed(2)}</td>

                                      <td className="px-2 py-2 text-center font-mono border-l">{s.dir_left}</td>
                                      <td className="px-2 py-2 text-center font-mono">{s.dir_center}</td>
                                      <td className="px-2 py-2 text-center font-mono">{s.dir_right}</td>
                                  </tr>
                              ))}
                              {teamBatterTotal && (
                                  <tr className="bg-slate-200/70 border-t-2 border-slate-300 font-bold">
                                      <td className="px-3 py-2 sticky left-0 bg-slate-200 border-r text-slate-800">チーム合計</td>
                                      
                                      <td className="px-2 py-2 text-center font-mono">{formatStat(teamBatterTotal.ops)}</td>
                                      <td className="px-2 py-2 text-center font-mono">{formatStat(teamBatterTotal.avg)}</td>
                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.hr}</td>
                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.rbi}</td>
                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.r}</td>
                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.sb}</td>
                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.pa}</td>

                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.h}</td>
                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.bb}</td>
                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.hbp}</td>
                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.so}</td>
                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.gidp}</td>

                                      <td className="px-2 py-2 text-center font-mono">{formatStat(teamBatterTotal.risp_avg)}</td>
                                      <td className="px-2 py-2 text-center font-mono">{formatStat(teamBatterTotal.obp)}</td>
                                      <td className="px-2 py-2 text-center font-mono">{formatStat(teamBatterTotal.slg)}</td>
                                      <td className="px-2 py-2 text-center font-mono">-</td>
                                      <td className="px-2 py-2 text-center font-mono">-</td>
                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.bb_k.toFixed(2)}</td>
                                      
                                      <td className="px-2 py-2 text-center font-mono border-l">{formatStat(teamBatterTotal.rc27, 2)}</td>
                                      <td className="px-2 py-2 text-center font-mono">{formatStat(teamBatterTotal.xr27, 2)}</td>
                                      <td className="px-2 py-2 text-center font-mono">-</td>
                                      <td className="px-2 py-2 text-center font-mono">-</td>
                                      <td className="px-2 py-2 text-center font-mono">-</td>
                                      <td className="px-2 py-2 text-center font-mono">{formatStat(teamBatterTotal.babip)}</td>

                                      <td className="px-2 py-2 text-center font-mono border-l">-</td>
                                      <td className="px-2 py-2 text-center font-mono">-</td>
                                      <td className="px-2 py-2 text-center font-mono">-</td>

                                      <td className="px-2 py-2 text-center font-mono border-l">{teamBatterTotal.dir_left}</td>
                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.dir_center}</td>
                                      <td className="px-2 py-2 text-center font-mono">{teamBatterTotal.dir_right}</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {/* --- PITCHER VIEW --- */}
          {view === 'pitcher' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                   {/* Pitcher Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="lg:col-span-1 h-64 border rounded-xl p-4 flex flex-col items-center">
                           <h4 className="font-bold text-slate-500 mb-2 flex items-center gap-2 w-full">
                               <MapPin size={16}/> 
                               <span>被安打傾向: {getCurrentPlayerName()}</span>
                           </h4>
                           <div className="relative w-48 h-48 bg-green-700 rounded-lg shadow-inner overflow-hidden">
                                  <svg width="100%" height="100%" viewBox="0 0 100 100">
                                      <rect width="100" height="100" fill="#15803d" />
                                      <line x1="50" y1="85" x2="0" y2="35" stroke="white" strokeWidth="0.5" />
                                      <line x1="50" y1="85" x2="100" y2="35" stroke="white" strokeWidth="0.5" />
                                      <path d="M 50 85 L 75 60 L 50 35 L 25 60 Z" fill="#a36936" opacity="0.8" />
                                      <path d="M 0 35 Q 50 -10 100 35" stroke="white" strokeWidth="0.5" fill="none" />
                                      
                                      {pitcherSprayData.map((d, i) => (
                                          <circle key={i} cx={d.x} cy={d.y} r="2" fill={d.isOut ? '#22d3ee' : '#facc15'} stroke={d.isOut ? 'blue' : 'black'} strokeWidth="0.5" opacity="0.9" />
                                      ))}
                                  </svg>
                           </div>
                           <div className="flex gap-4 mt-2 text-xs font-bold text-slate-600">
                               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400 border border-black"/> 被安打 ({pitcherSprayData.filter(s=>!s.isOut).length})</div>
                               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-400 border border-blue-600"/> アウト ({pitcherSprayData.filter(s=>s.isOut).length})</div>
                           </div>
                      </div>
                      
                      {/* Trend Analysis (Pitcher) */}
                      <div className="lg:col-span-1 h-64 border rounded-xl p-4 flex flex-col">
                           <div className="flex justify-between items-center mb-2 gap-4">
                               <h4 className="font-bold text-slate-500 flex items-center gap-2"><Activity size={16}/> トレンド: {getCurrentPlayerName()}</h4>
                               <div className="flex gap-2">
                                  <select 
                                      className="p-1 border rounded text-xs font-bold bg-white"
                                      value={trendMetric}
                                      onChange={(e) => setTrendMetric(e.target.value as any)}
                                  >
                                      <option value="era">防御率</option>
                                      <option value="whip">WHIP</option>
                                  </select>
                               </div>
                           </div>
                           <div className="flex-1 w-full min-h-0">
                              {trendData.length > 1 ? (
                                  <ResponsiveContainer width="100%" height="100%">
                                      <LineChart data={trendData}>
                                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                          <XAxis dataKey="date" tick={{fontSize: 10}} />
                                          <YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} />
                                          <Tooltip labelStyle={{color:'black'}} />
                                          <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={{r:3}} />
                                      </LineChart>
                                  </ResponsiveContainer>
                              ) : (
                                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">データ不足</div>
                              )}
                           </div>
                      </div>
                  </div>

                   {pitcherStats.length === 0 ? (
                       <div className="text-center py-20 text-slate-400">投手データがありません</div>
                   ) : (
                       <div className="overflow-x-auto border rounded-xl shadow-inner bg-white">
                            <table className="w-full text-xs text-left whitespace-nowrap">
                                <thead className="bg-slate-100 text-slate-600 font-bold border-b-2 border-slate-200">
                                    <tr>
                                        <th className="px-3 py-4 sticky left-0 bg-slate-100 z-10 border-r min-w-[120px]">選手名</th>
                                        
                                        {/* Basic */}
                                        <th className="px-2 py-4 bg-red-50 text-center text-red-800">防御率</th>
                                        <th className="px-2 py-4 text-center">勝</th>
                                        <th className="px-2 py-4 text-center">負</th>
                                        <th className="px-2 py-4 text-center">S</th>
                                        <th className="px-2 py-4 text-center">H</th>
                                        <th className="px-2 py-4 text-center bg-yellow-50 border-x">投球回</th>
                                        
                                        {/* Counts */}
                                        <th className="px-2 py-4 text-center">球数</th>
                                        <th className="px-2 py-4 text-center">被安</th>
                                        <th className="px-2 py-4 text-center">被本</th>
                                        <th className="px-2 py-4 text-center">四球</th>
                                        <th className="px-2 py-4 text-center">死球</th>
                                        <th className="px-2 py-4 text-center">三振</th>
                                        <th className="px-2 py-4 text-center">失点</th>
                                        <th className="px-2 py-4 text-center border-r">自責</th>

                                        {/* Rates 1 */}
                                        <th className="px-2 py-4 text-center bg-blue-50">WHIP</th>
                                        <th className="px-2 py-4 text-center bg-blue-50">K/BB</th>
                                        <th className="px-2 py-4 text-center bg-blue-50">奪三振率</th>
                                        <th className="px-2 py-4 text-center bg-blue-50">被本率</th>
                                        
                                        {/* Advanced */}
                                        <th className="px-2 py-4 text-center border-l">QS率</th>
                                        <th className="px-2 py-4 text-center">HQS率</th>
                                        <th className="px-2 py-4 text-center">FIP</th>
                                        <th className="px-2 py-4 text-center">LOB%</th>
                                        <th className="px-2 py-4 text-center">BABIP</th>
                                        <th className="px-2 py-4 text-center">被出塁率</th>
                                        <th className="px-2 py-4 text-center">被長打率</th>
                                        <th className="px-2 py-4 text-center">GO/AO</th>
                                        
                                        {/* Contribution */}
                                        <th className="px-2 py-4 text-center border-l bg-green-50">KD</th>
                                        <th className="px-2 py-4 text-center bg-green-50">RSAA</th>
                                        <th className="px-2 py-4 text-center bg-green-50">PR</th>
                                        <th className="px-2 py-4 text-center bg-green-50">援護率</th>
                                        
                                        {/* Relief/Misc */}
                                        <th className="px-2 py-4 text-center border-l">連投(日)</th>
                                        <th className="px-2 py-4 text-center">IPR</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pitcherStats.map(s => (
                                        <tr key={s.playerId} className="hover:bg-slate-50 transition h-10">
                                            <td className="px-3 py-2 sticky left-0 bg-white border-r font-bold text-slate-800">{s.name}</td>
                                            
                                            <td className="px-2 py-2 text-center font-mono font-bold text-red-600 bg-red-50/50">{s.era.toFixed(2)}</td>
                                            <td className="px-2 py-2 text-center font-mono">{s.wins}</td>
                                            <td className="px-2 py-2 text-center font-mono">{s.losses}</td>
                                            <td className="px-2 py-2 text-center font-mono">{s.saves}</td>
                                            <td className="px-2 py-2 text-center font-mono">{s.holds}</td>
                                            <td className="px-2 py-2 text-center font-mono bg-yellow-50/50 border-x font-bold">{s.ipDisplay}</td>
                                            
                                            <td className="px-2 py-2 text-center font-mono text-slate-500">{s.p_count}</td>
                                            <td className="px-2 py-2 text-center font-mono">{s.h}</td>
                                            <td className="px-2 py-2 text-center font-mono">{s.hr}</td>
                                            <td className="px-2 py-2 text-center font-mono">{s.bb}</td>
                                            <td className="px-2 py-2 text-center font-mono">{s.hbp}</td>
                                            <td className="px-2 py-2 text-center font-mono">{s.k}</td>
                                            <td className="px-2 py-2 text-center font-mono text-slate-500">{s.r}</td>
                                            <td className="px-2 py-2 text-center font-mono text-slate-500 border-r">{s.er}</td>

                                            <td className="px-2 py-2 text-center font-mono bg-blue-50/30 font-bold">{s.whip.toFixed(2)}</td>
                                            <td className="px-2 py-2 text-center font-mono bg-blue-50/30">{s.k_bb.toFixed(2)}</td>
                                            <td className="px-2 py-2 text-center font-mono bg-blue-50/30">{s.k_rate.toFixed(2)}</td>
                                            <td className="px-2 py-2 text-center font-mono bg-blue-50/30">{s.hr_9.toFixed(2)}</td>

                                            <td className="px-2 py-2 text-center font-mono border-l">{(s.qs_rate*100).toFixed(0)}%</td>
                                            <td className="px-2 py-2 text-center font-mono">{(s.hqs_rate*100).toFixed(0)}%</td>
                                            <td className="px-2 py-2 text-center font-mono">{s.fip.toFixed(2)}</td>
                                            <td className="px-2 py-2 text-center font-mono">{(s.lob_pct*100).toFixed(0)}%</td>
                                            <td className="px-2 py-2 text-center font-mono text-slate-500">{s.babip.toFixed(3)}</td>
                                            <td className="px-2 py-2 text-center font-mono text-slate-500">{s.oba.toFixed(3)}</td>
                                            <td className="px-2 py-2 text-center font-mono text-slate-500">{s.slg_allowed.toFixed(3)}</td>
                                            <td className="px-2 py-2 text-center font-mono text-slate-500">{s.go_ao.toFixed(2)}</td>
                                            
                                            <td className="px-2 py-2 text-center font-mono border-l bg-green-50/30 font-bold">{s.kokendo}</td>
                                            <td className="px-2 py-2 text-center font-mono bg-green-50/30">{s.rsaa.toFixed(1)}</td>
                                            <td className="px-2 py-2 text-center font-mono bg-green-50/30">{s.pr.toFixed(2)}</td>
                                            <td className="px-2 py-2 text-center font-mono bg-green-50/30">{s.run_support_rate.toFixed(2)}</td>
                                            
                                            <td className="px-2 py-2 text-center font-mono border-l">{s.consecutive_days}</td>
                                            <td className="px-2 py-2 text-center font-mono">{s.ipr===99?'---':s.ipr.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {teamPitcherTotal && (
                                        <tr className="bg-slate-200/70 border-t-2 border-slate-300 font-bold">
                                            <td className="px-3 py-2 sticky left-0 bg-slate-200 border-r text-slate-800">チーム合計</td>
                                            
                                            <td className="px-2 py-2 text-center font-mono font-bold text-red-600">{teamPitcherTotal.era.toFixed(2)}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.wins}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.losses}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.saves}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.holds}</td>
                                            <td className="px-2 py-2 text-center font-mono bg-yellow-50/50 border-x">{teamPitcherTotal.ipDisplay}</td>
                                            
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.p_count}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.h}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.hr}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.bb}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.hbp}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.k}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.r}</td>
                                            <td className="px-2 py-2 text-center font-mono border-r">{teamPitcherTotal.er}</td>

                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.whip.toFixed(2)}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.k_bb.toFixed(2)}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.k_rate.toFixed(2)}</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.hr_9.toFixed(2)}</td>

                                            <td className="px-2 py-2 text-center font-mono border-l">-</td>
                                            <td className="px-2 py-2 text-center font-mono">-</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.fip.toFixed(2)}</td>
                                            <td className="px-2 py-2 text-center font-mono">{(teamPitcherTotal.lob_pct*100).toFixed(0)}%</td>
                                            <td className="px-2 py-2 text-center font-mono">{teamPitcherTotal.babip.toFixed(3)}</td>
                                            <td className="px-2 py-2 text-center font-mono">-</td>
                                            <td className="px-2 py-2 text-center font-mono">-</td>
                                            <td className="px-2 py-2 text-center font-mono">-</td>
                                            
                                            <td className="px-2 py-2 text-center font-mono border-l">-</td>
                                            <td className="px-2 py-2 text-center font-mono">-</td>
                                            <td className="px-2 py-2 text-center font-mono">-</td>
                                            <td className="px-2 py-2 text-center font-mono">-</td>
                                            
                                            <td className="px-2 py-2 text-center font-mono border-l">-</td>
                                            <td className="px-2 py-2 text-center font-mono">-</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                       </div>
                   )}
              </div>
          )}
          
          <div className="mt-4 flex items-center justify-end text-xs text-slate-400 gap-1">
              <Info size={14}/>
              <span>各種相対指標（RCAA, RSAAなど）は、現在表示されているチーム内選手の平均成績を基準（ゼロ）として算出されています。</span>
          </div>

          <MetricsGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      </div>
    </div>
  );
};
