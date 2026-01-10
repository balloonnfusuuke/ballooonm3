import React, { useState, useEffect } from 'react';
import { PlateAppearance, GameBatchRecord, BatterStats, PitcherStats, Player } from '../types';
import { getPARecords, getBatchRecords, getPitcherRecords, exportUnifiedCSV, getPlayers } from '../services/dataService';
import { calculateBatterStats, calculatePitcherStats, calculateLeagueStats, formatStat } from '../services/statsService';
import { Download, BarChart2, TrendingUp, RefreshCw, User, Target, MapPin, Calendar, Activity, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';

type DateRange = 'all' | 'month' | 'week';
type TrendMetric = 'avg' | 'ops' | 'era' | 'whip';

export const Dashboard: React.FC = () => {
  const [view, setView] = useState<'batter' | 'pitcher'>('batter');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  
  // Data State
  const [batterStats, setBatterStats] = useState<BatterStats[]>([]);
  const [pitcherStats, setPitcherStats] = useState<PitcherStats[]>([]);
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);
  
  // Spray Chart Data
  const [sprayData, setSprayData] = useState<Array<{x: number, y: number, result: string, isHit: boolean}>>([]);
  const [pitcherSprayData, setPitcherSprayData] = useState<Array<{x: number, y: number, result: string, isOut: boolean}>>([]);

  // Trend State
  const [trendPlayerId, setTrendPlayerId] = useState<string>('');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('avg');
  const [trendData, setTrendData] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [dateRange]);

  // Effect to set default trend player when stats load
  useEffect(() => {
      if (!trendPlayerId && batterStats.length > 0 && view === 'batter') {
          setTrendPlayerId(batterStats[0].playerId);
      } else if (!trendPlayerId && pitcherStats.length > 0 && view === 'pitcher') {
          setTrendPlayerId(pitcherStats[0].playerId);
      }
  }, [batterStats, pitcherStats, view]);

  // Effect to recalculate trends when selection changes
  useEffect(() => {
      if (trendPlayerId) calculateTrends(trendPlayerId);
  }, [trendPlayerId, trendMetric, dateRange]);

  const getDateCutoff = () => {
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
    const validBatterIds = new Set(currentPlayers.filter(p => p.type !== 'pitcher').map(p => p.id));
    const validPitcherIds = new Set(currentPlayers.filter(p => p.type !== 'batter').map(p => p.id));
    
    setActivePlayers(currentPlayers);

    // --- BATTERS ---
    const allPLive = getPARecords();
    const allPBatch = getBatchRecords();

    // Filter by Date
    const pLive = cutoff ? allPLive.filter(r => new Date(r.date) >= cutoff) : allPLive;
    const pBatch = cutoff ? allPBatch.filter(r => new Date(r.date) >= cutoff) : allPBatch;

    // Filter by Valid Players (Deleted players removed)
    // We iterate through the ROSTER, not the records, to ensure we only show active players
    const finalBStats: BatterStats[] = [];
    const tempStatsForLeague: BatterStats[] = []; // For league avg calc

    currentPlayers.filter(p => p.type !== 'pitcher').forEach(p => {
        const pRecs = pLive.filter(r => r.playerId === p.id);
        const bRecs = pBatch.filter(r => r.playerId === p.id);
        
        // Skip if no data in range? optional. 
        // For now we calculate everyone in roster, even if 0 stats, so they appear in table.
        const s = calculateBatterStats(pRecs, bRecs);
        tempStatsForLeague.push(s);
    });

    // League Stats Calculation
    let l_pa=0, l_rc=0, l_xr=0, l_runs=0;
    tempStatsForLeague.forEach(b => { l_pa+=b.pa; l_rc+=b.rc; l_xr+=b.xr; l_runs+=b.r; });
    const lgBatterStats = { totalPA: l_pa, totalRC: l_rc, totalXR: l_xr, totalRuns: l_runs, totalInnings: l_pa/4.2 };

    // Final Batter Calculation with League Context
    currentPlayers.filter(p => p.type !== 'pitcher').forEach(p => {
        const pRecs = pLive.filter(r => r.playerId === p.id);
        const bRecs = pBatch.filter(r => r.playerId === p.id);
        if (pRecs.length === 0 && bRecs.length === 0) return; // Hide completely empty players? Or show 0s. Let's hide to keep clean.

        finalBStats.push(calculateBatterStats(pRecs, bRecs, lgBatterStats));
    });

    setBatterStats(finalBStats.sort((a,b) => b.ops - a.ops));

    // Spray Data (Only for valid players and date range)
    const activeIds = new Set(currentPlayers.map(p=>p.id));
    const sprays = pLive
        .filter(r => r.coordX !== undefined && r.coordY !== undefined && activeIds.has(r.playerId))
        .map(r => {
            const isHit = ['1B','2B','3B','HR'].includes(r.result);
            return { x: r.coordX!, y: r.coordY!, result: r.result, isHit };
        });
    setSprayData(sprays);


    // --- PITCHERS ---
    const allPRecords = getPitcherRecords();
    // Filter Date
    const pRecords = cutoff ? allPRecords.filter(r => new Date(r.date) >= cutoff) : allPRecords;
    
    // League Stats
    const leagueStats = calculateLeagueStats(pRecords); // Calculate league stats based on filtered data

    const finalPStats: PitcherStats[] = [];
    let allPitcherSprays: Array<{x: number, y: number, result: string, isOut: boolean}> = [];

    currentPlayers.filter(p => p.type !== 'batter').forEach(p => {
        const recs = pRecords.filter(r => r.playerId === p.id);
        if (recs.length === 0) return;

        const stats = calculatePitcherStats(recs, leagueStats);
        finalPStats.push(stats);
        
        if (stats.spray_data) {
             const mapped = stats.spray_data.map(s => ({ ...s, isOut: ['GO','FO'].includes(s.result) }));
             allPitcherSprays = allPitcherSprays.concat(mapped);
        }
    });

    setPitcherStats(finalPStats.sort((a,b) => {
        if (a.era === 0 && a.outs > 0) return -1; // 0.00 ERA goes top
        if (b.era === 0 && b.outs > 0) return 1;
        if (a.era === 0 && a.outs === 0) return 1; // No stats goes bottom
        return a.era - b.era;
    }));
    setPitcherSprayData(allPitcherSprays);
  };

  // --- Trend Calculation Logic ---
  const calculateTrends = (playerId: string) => {
      const cutoff = getDateCutoff();
      const chartData: any[] = [];
      
      if (view === 'batter') {
          const allLive = getPARecords().filter(r => r.playerId === playerId);
          const allBatch = getBatchRecords().filter(r => r.playerId === playerId);
          
          // Combine and sort chronologically
          const events = [
              ...allLive.map(r => ({ date: r.date, type: 'live', data: r })),
              ...allBatch.map(r => ({ date: r.date, type: 'batch', data: r }))
          ].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Accumulator
          let accH = 0, accAB = 0, accBB = 0, accHBP = 0, accSF = 0, accTB = 0;

          events.forEach(e => {
              if (cutoff && new Date(e.date) < cutoff) return; // Skip if outside range (but accumulator needs full history for "current status"? No, usually graph shows performance IN period or Cumulative. Let's do Cumulative IN Period)
              
              // If we want period-specific growth, we should reset acc?
              // Usually "Growth Curve" implies season stats. Let's assume Cumulative Season Stats displayed over time.
              // So we should ACCUMULATE from start of season (or all time), but only DISPLAY points within range?
              // Let's keep it simple: Accumulate within the filtered range for now.

              // Calculate incremental
              let h=0, ab=0, bb=0, hbp=0, sf=0, tb=0;
              if (e.type === 'live') {
                  const r = e.data as PlateAppearance;
                  if (['1B','2B','3B','HR','SO','GO','FO','ROE','FC'].includes(r.result)) ab=1;
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
              
              // Calc Rate
              let val = 0;
              if (trendMetric === 'avg') val = accAB > 0 ? accH / accAB : 0;
              if (trendMetric === 'ops') {
                  const obp = (accAB+accBB+accHBP+accSF) > 0 ? (accH+accBB+accHBP)/(accAB+accBB+accHBP+accSF) : 0;
                  const slg = accAB > 0 ? accTB / accAB : 0;
                  val = obp + slg;
              }

              // Push data point (Aggregated by day? or per event? Per day is cleaner)
              const existing = chartData.find(c => c.date === e.date);
              if (existing) {
                  existing.value = val; // Update with latest accum
              } else {
                  chartData.push({ date: e.date.substring(5), fullDate: e.date, value: val });
              }
          });
      } else {
          // Pitcher Trends
          const allRecs = getPitcherRecords().filter(r => r.playerId === playerId)
                          .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
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

  // Logic for Team Leaders (Avoid 1.000 avg with 1 AB)
  const getQualifiedLeader = (stats: BatterStats[], key: keyof BatterStats, minPaPercent: number = 0.3) => {
      if (stats.length === 0) return null;
      const maxPa = Math.max(...stats.map(s => s.pa));
      // Threshold: e.g. 30% of Team Max PA, or at least 5 PA
      const threshold = Math.max(5, maxPa * minPaPercent);
      
      const qualified = stats.filter(s => s.pa >= threshold);
      if (qualified.length === 0) return stats[0]; // Fallback
      
      return qualified.sort((a,b) => (b[key] as number) - (a[key] as number))[0];
  };

  const bestAvg = getQualifiedLeader(batterStats, 'avg');
  const mostHr = getQualifiedLeader(batterStats, 'hr', 0); // HR doesn't need rate qualification

  return (
    <div className="space-y-6 max-w-[95%] mx-auto pb-20">
      
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-team-navy">チーム成績ダッシュボード</h2>
          <p className="text-slate-500">データを一元管理・分析</p>
        </div>
        <div className="flex flex-wrap gap-3 mt-4 md:mt-0 justify-end">
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setDateRange('all')} className={`px-3 py-1 text-xs font-bold rounded transition ${dateRange==='all' ? 'bg-white shadow text-team-navy' : 'text-slate-400'}`}>全期間</button>
                <button onClick={() => setDateRange('month')} className={`px-3 py-1 text-xs font-bold rounded transition ${dateRange==='month' ? 'bg-white shadow text-team-navy' : 'text-slate-400'}`}>月間</button>
                <button onClick={() => setDateRange('week')} className={`px-3 py-1 text-xs font-bold rounded transition ${dateRange==='week' ? 'bg-white shadow text-team-navy' : 'text-slate-400'}`}>週間</button>
            </div>
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

      {/* View Toggle */}
      <div className="flex gap-2">
          <button onClick={() => { setView('batter'); setTrendMetric('avg'); }} className={`px-6 py-2 rounded-t-lg font-bold text-sm transition ${view==='batter' ? 'bg-white text-blue-700 shadow-sm' : 'bg-slate-200 text-slate-500'}`}>
              <span className="flex items-center gap-2"><User size={16}/> 野手成績</span>
          </button>
          <button onClick={() => { setView('pitcher'); setTrendMetric('era'); }} className={`px-6 py-2 rounded-t-lg font-bold text-sm transition ${view==='pitcher' ? 'bg-white text-red-700 shadow-sm' : 'bg-slate-200 text-slate-500'}`}>
              <span className="flex items-center gap-2"><Target size={16}/> 投手成績</span>
          </button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
          
          {/* --- BATTER VIEW --- */}
          {view === 'batter' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                  {/* Top Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-1 h-64 border rounded-xl p-4">
                          <h4 className="font-bold text-slate-500 mb-2 flex items-center gap-2"><TrendingUp size={16}/> OPS Leaders</h4>
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
                      <div className="lg:col-span-1 h-64 border rounded-xl p-4 flex flex-col items-center">
                           <h4 className="font-bold text-slate-500 mb-2 flex items-center gap-2 w-full"><MapPin size={16}/> チーム打球傾向</h4>
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
                                          <circle key={i} cx={d.x} cy={d.y} r="1.5" fill={d.isHit ? 'red' : 'cyan'} stroke={d.isHit ? 'none' : 'blue'} strokeWidth="0.5" opacity="0.9" />
                                      ))}
                                  </svg>
                           </div>
                           <div className="flex gap-4 mt-2 text-xs font-bold text-slate-600">
                               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/> 安打</div>
                               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-400 border border-blue-600"/> アウト</div>
                           </div>
                      </div>
                      
                      {/* Summary Cards */}
                      <div className="lg:col-span-1 grid grid-cols-2 gap-4">
                          <div className="bg-blue-50 p-4 rounded-xl flex flex-col justify-center border border-blue-100">
                              <div className="text-xs text-blue-500 font-bold mb-1">チーム最高打率 (規定有)</div>
                              <div className="text-2xl font-bold text-blue-900">{bestAvg?.avg.toFixed(3) || '-'}</div>
                              <div className="text-xs text-slate-500 mt-1">{bestAvg?.name || '対象なし'}</div>
                          </div>
                          <div className="bg-red-50 p-4 rounded-xl flex flex-col justify-center border border-red-100">
                              <div className="text-xs text-red-500 font-bold mb-1">チーム最多本塁打</div>
                              <div className="text-2xl font-bold text-red-900">{mostHr?.hr || 0} 本</div>
                              <div className="text-xs text-slate-500 mt-1">{mostHr?.name || '対象なし'}</div>
                          </div>
                      </div>
                  </div>

                  {/* Trend Analysis Section */}
                  <div className="border rounded-xl p-6 bg-slate-50/50">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                          <h3 className="font-bold text-slate-700 flex items-center gap-2">
                              <Activity size={20} /> 成長曲線・トレンド分析
                          </h3>
                          <div className="flex gap-2">
                              <select 
                                  className="p-2 border rounded text-sm font-bold bg-white"
                                  value={trendPlayerId}
                                  onChange={(e) => setTrendPlayerId(e.target.value)}
                              >
                                  {batterStats.map(p => <option key={p.playerId} value={p.playerId}>{p.name}</option>)}
                              </select>
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
                                  <th className="px-2 py-4 text-center">TTO率</th>
                                  
                                  {/* Relative */}
                                  <th className="px-2 py-4 text-center border-l bg-green-50">RCAA</th>
                                  <th className="px-2 py-4 text-center bg-green-50">XR+</th>
                                  <th className="px-2 py-4 text-center bg-green-50">RCWIN</th>

                                  {/* Direction */}
                                  <th className="px-2 py-4 text-center border-l">左打</th>
                                  <th className="px-2 py-4 text-center">中打</th>
                                  <th className="px-2 py-4 text-center">右打</th>

                                  {/* Counts High */}
                                  <th className="px-2 py-4 text-center border-l text-[10px]">猛打賞</th>
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
                                      <td className="px-2 py-2 text-center font-mono">{(s.tto_rate*100).toFixed(1)}%</td>

                                      <td className="px-2 py-2 text-center font-mono border-l bg-green-50/30">{s.rcaa.toFixed(1)}</td>
                                      <td className="px-2 py-2 text-center font-mono bg-green-50/30">{s.xr_plus.toFixed(1)}</td>
                                      <td className="px-2 py-2 text-center font-mono bg-green-50/30">{s.rcwin.toFixed(2)}</td>

                                      <td className="px-2 py-2 text-center font-mono border-l">{s.dir_left}</td>
                                      <td className="px-2 py-2 text-center font-mono">{s.dir_center}</td>
                                      <td className="px-2 py-2 text-center font-mono">{s.dir_right}</td>

                                      <td className="px-2 py-2 text-center font-mono border-l">{s.mouda}</td>
                                  </tr>
                              ))}
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
                           <h4 className="font-bold text-slate-500 mb-2 flex items-center gap-2 w-full"><MapPin size={16}/> 被安打・アウト分布</h4>
                           <div className="relative w-48 h-48 bg-green-700 rounded-lg shadow-inner overflow-hidden">
                                  <svg width="100%" height="100%" viewBox="0 0 100 100">
                                      <rect width="100" height="100" fill="#15803d" />
                                      <line x1="50" y1="85" x2="0" y2="35" stroke="white" strokeWidth="0.5" />
                                      <line x1="50" y1="85" x2="100" y2="35" stroke="white" strokeWidth="0.5" />
                                      <path d="M 50 85 L 75 60 L 50 35 L 25 60 Z" fill="#a36936" opacity="0.8" />
                                      <path d="M 0 35 Q 50 -10 100 35" stroke="white" strokeWidth="0.5" fill="none" />
                                      
                                      {pitcherSprayData.map((d, i) => (
                                          <circle key={i} cx={d.x} cy={d.y} r="1.5" fill={d.isOut ? 'cyan' : 'yellow'} stroke={d.isOut ? 'blue' : 'black'} strokeWidth="0.5" opacity="0.9" />
                                      ))}
                                  </svg>
                           </div>
                           <div className="flex gap-4 mt-2 text-xs font-bold text-slate-600">
                               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400 border border-black"/> 被安打</div>
                               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-400 border border-blue-600"/> アウト</div>
                           </div>
                      </div>
                      
                      {/* Trend Analysis (Pitcher) */}
                      <div className="lg:col-span-1 h-64 border rounded-xl p-4 flex flex-col">
                           <div className="flex justify-between items-center mb-2">
                               <h4 className="font-bold text-slate-500 flex items-center gap-2"><Activity size={16}/> トレンド分析</h4>
                               <div className="flex gap-2">
                                  <select 
                                      className="p-1 border rounded text-xs font-bold bg-white"
                                      value={trendPlayerId}
                                      onChange={(e) => setTrendPlayerId(e.target.value)}
                                  >
                                      {pitcherStats.map(p => <option key={p.playerId} value={p.playerId}>{p.name}</option>)}
                                  </select>
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

      </div>
    </div>
  );
};