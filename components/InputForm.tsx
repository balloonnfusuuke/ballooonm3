import React, { useState, useEffect } from 'react';
import { Player, PlateAppearance, ResultType, PositionNum, GameBatchRecord, PitcherGameRecord, Opponent } from '../types';
import { getPlayers, getOpponents, savePARecord, saveBatchRecord, savePitcherRecord, generateUUID } from '../services/dataService';
import { Save, AlertCircle, Plus, Minus, Zap, ClipboardList, User, Target, ChevronDown, ChevronUp, MapPin, Undo2 } from 'lucide-react';

type PitcherFormState = Partial<PitcherGameRecord> & {
  ip: number;
  outs_frac: 0 | 1 | 2;
  allowed_spray: Array<{x: number, y: number, result: string}>;
};

export const InputForm: React.FC = () => {
  const [playerType, setPlayerType] = useState<'batter' | 'pitcher'>('batter');
  const [mode, setMode] = useState<'live' | 'batch'>('live');
  const [players, setPlayers] = useState<Player[]>([]);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [opponent, setOpponent] = useState<string>('');
  
  // --- Live Batter Mode State ---
  const [inning, setInning] = useState<number>(1);
  const [runners, setRunners] = useState({ 1: false, 2: false, 3: false });
  const [liveRbi, setLiveRbi] = useState<number>(0);
  const [selectedResult, setSelectedResult] = useState<ResultType | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<PositionNum>(0); // 0 = unknown
  
  // Scorebook Mode
  const [inputMode, setInputMode] = useState<'simple' | 'scorebook'>('simple');
  const [ballCoord, setBallCoord] = useState<{x: number, y: number} | null>(null);
  
  // Pitcher Scorebook Temp State
  const [pitcherSprayType, setPitcherSprayType] = useState<'1B'|'2B'|'3B'|'HR'|'GO'|'FO'>('1B');

  // --- Batch Batter Mode State ---
  const [batchStats, setBatchStats] = useState({
    ab: 0, h: 0, double: 0, triple: 0, hr: 0,
    bb: 0, ibb: 0, hbp: 0, k: 0, sf: 0, sac: 0, r: 0, rbi: 0,
    sb: 0, cs: 0, gidp: 0
  });

  // --- Pitcher Mode State ---
  const [pStats, setPStats] = useState<PitcherFormState>({
      isStarter: true,
      ip: 0, outs_frac: 0, 
      h: 0, hr: 0, bb: 0, ibb: 0, hbp: 0, k: 0, wild_pitch: 0,
      r: 0, er: 0, p_count: 0,
      result: null,
      ab: 0, h2: 0, h3: 0, sac: 0, sf: 0, go: 0, fo: 0,
      run_support: 0, support_innings: 0,
      stop_win_streak: false, stop_loss_streak: false,
      allowed_spray: []
  });
  
  const computedOuts = ((pStats.ip||0) * 3) + (pStats.outs_frac||0);

  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [showDetailPitcher, setShowDetailPitcher] = useState(false);

  useEffect(() => {
    setPlayers(getPlayers());
    setOpponents(getOpponents());
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const validateCommon = () => {
    if (!selectedPlayerId) { showMessage('error', '選手を選択してください'); return false; }
    if (!opponent) { showMessage('error', '対戦相手を入力してください'); return false; }
    return true;
  };

  const handleFieldClick = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setBallCoord({ x, y });

      if (playerType === 'batter') {
          // Auto-determine direction based on X coordinate
          if (x < 35) setSelectedDirection(7); // Left
          else if (x > 65) setSelectedDirection(9); // Right
          else setSelectedDirection(8); // Center
      } else {
          // PITCHER MODE: Immediately Add to Spray List & Auto Increment
          const newSpray = { x, y, result: pitcherSprayType };
          
          setPStats(prev => {
              const next = {
                  ...prev,
                  allowed_spray: [...(prev.allowed_spray||[]), newSpray]
              };
              
              // Auto-increment counters based on spray type
              if(['1B','2B','3B','HR'].includes(pitcherSprayType)) {
                  next.h = (prev.h||0) + 1;
              }
              if(pitcherSprayType === '2B') next.h2 = (prev.h2||0) + 1;
              if(pitcherSprayType === '3B') next.h3 = (prev.h3||0) + 1;
              if(pitcherSprayType === 'HR') next.hr = (prev.hr||0) + 1;
              if(pitcherSprayType === 'GO') next.go = (prev.go||0) + 1;
              if(pitcherSprayType === 'FO') next.fo = (prev.fo||0) + 1;
              
              return next;
          });
      }
  };
  
  const handlePitcherUndoSpray = () => {
      setPStats(prev => {
          const list = prev.allowed_spray || [];
          if (list.length === 0) return prev;
          const last = list[list.length - 1];
          
          const next = {
              ...prev,
              allowed_spray: list.slice(0, -1)
          };
          
          // Decrement counters
          if(['1B','2B','3B','HR'].includes(last.result)) {
              next.h = Math.max(0, (prev.h||0) - 1);
          }
          if(last.result === '2B') next.h2 = Math.max(0, (prev.h2||0) - 1);
          if(last.result === '3B') next.h3 = Math.max(0, (prev.h3||0) - 1);
          if(last.result === 'HR') next.hr = Math.max(0, (prev.hr||0) - 1);
          if(last.result === 'GO') next.go = Math.max(0, (prev.go||0) - 1);
          if(last.result === 'FO') next.fo = Math.max(0, (prev.fo||0) - 1);

          return next;
      });
  };

  const handleBatterLiveSubmit = () => {
    if (!validateCommon()) return;
    if (!selectedResult) { showMessage('error', '結果を選択してください'); return; }
    const player = players.find(p => p.id === selectedPlayerId);
    
    // Default direction if not selected (Optional feature, defaulted to 0/Center-ish for now if skipped)
    const direction = selectedDirection || 0; 
    
    const record: PlateAppearance = {
      id: generateUUID(), gameId: `${date}-${opponent}`,
      date, opponent, playerId: selectedPlayerId, playerName: player?.name || 'Unknown',
      inning, isTop: true, runner1: runners[1], runner2: runners[2], runner3: runners[3],
      result: selectedResult, direction, rbi: liveRbi, isSteal: false,
      coordX: ballCoord?.x, coordY: ballCoord?.y
    };
    savePARecord(record);
    showMessage('success', '【野手:速報】記録しました');
    setSelectedResult(null); setSelectedDirection(0); setLiveRbi(0); setBallCoord(null);
  };

  const handleBatterBatchSubmit = () => {
    if (!validateCommon()) return;
    const player = players.find(p => p.id === selectedPlayerId);
    const record: GameBatchRecord = {
      id: generateUUID(), date, opponent,
      playerId: selectedPlayerId, playerName: player?.name || 'Unknown',
      ...batchStats
    };
    saveBatchRecord(record);
    showMessage('success', '【野手:一括】保存しました');
    setBatchStats({ ab: 0, h: 0, double: 0, triple: 0, hr: 0, bb: 0, ibb: 0, hbp: 0, k: 0, sf: 0, sac: 0, r: 0, rbi: 0, sb: 0, cs: 0, gidp: 0 });
  };

  const handlePitcherSubmit = () => {
      if (!validateCommon()) return;
      const player = players.find(p => p.id === selectedPlayerId);
      
      const record: PitcherGameRecord = {
          id: generateUUID(), date, opponent,
          playerId: selectedPlayerId, playerName: player?.name || 'Unknown',
          outs: computedOuts,
          isStarter: pStats.isStarter ?? true,
          result: pStats.result ?? null,
          h: pStats.h||0, hr: pStats.hr||0, r: pStats.r||0, er: pStats.er||0,
          bb: pStats.bb||0, ibb: pStats.ibb||0, hbp: pStats.hbp||0, k: pStats.k||0,
          wild_pitch: pStats.wild_pitch||0, p_count: pStats.p_count||0,
          ab: pStats.ab||0, h2: pStats.h2||0, h3: pStats.h3||0,
          sac: pStats.sac||0, sf: pStats.sf||0, go: pStats.go||0, fo: pStats.fo||0,
          run_support: pStats.run_support||0, support_innings: pStats.support_innings||0,
          stop_win_streak: pStats.stop_win_streak||false, stop_loss_streak: pStats.stop_loss_streak||false,
          allowed_spray: pStats.allowed_spray
      };
      savePitcherRecord(record);
      showMessage('success', '【投手】保存しました');
      setPStats({
          isStarter: true, ip: 0, outs_frac: 0,
          h: 0, hr: 0, bb: 0, ibb:0, hbp: 0, k: 0, wild_pitch:0, r: 0, er: 0, p_count:0, result: null,
          ab: 0, h2: 0, h3: 0, sac: 0, sf: 0, go: 0, fo: 0, run_support: 0, support_innings: 0,
          stop_win_streak: false, stop_loss_streak: false,
          allowed_spray: []
      });
  };

  const Counter = ({ label, val, setVal, colorClass="bg-slate-100", step=1 }: any) => (
    <div className="flex flex-col items-center bg-white p-2 rounded border border-slate-200 shadow-sm min-w-[70px]">
      <span className="text-[10px] text-slate-500 font-bold mb-1 whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => setVal(Math.max(0, (val||0) - step))} className={`w-6 h-6 rounded flex items-center justify-center ${colorClass}`}><Minus size={12}/></button>
        <input type="number" min="0" value={val||0} onChange={(e) => setVal(parseInt(e.target.value)||0)} onFocus={(e)=>e.target.select()} className="w-10 text-center font-bold outline-none bg-transparent text-sm" />
        <button onClick={() => setVal((val||0) + step)} className={`w-6 h-6 rounded flex items-center justify-center ${colorClass}`}><Plus size={12}/></button>
      </div>
    </div>
  );

  const ResultButton = ({ res, label, color="bg-white hover:bg-slate-50" }: any) => (
      <button onClick={() => setSelectedResult(res)} className={`py-3 rounded-lg font-bold text-sm border transition ${selectedResult === res ? 'bg-team-navy text-white' : color}`}>
          {label}
      </button>
  );
  
  const PitcherSprayButton = ({ res, label, type='hit' }: {res: any, label: string, type?: 'hit'|'out'}) => {
      const isSelected = pitcherSprayType === res;
      let baseColor = 'bg-white text-slate-500';
      if (isSelected) {
          baseColor = type === 'hit' ? 'bg-team-red text-white border-team-red' : 'bg-blue-600 text-white border-blue-600';
      }
      return (
          <button onClick={() => setPitcherSprayType(res)} className={`flex-1 py-1 rounded font-bold text-xs border transition ${baseColor}`}>
              {label}
          </button>
      );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Top Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-700 flex items-center gap-2"><User size={18}/> 選手・試合情報</h3>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                  <button onClick={() => setPlayerType('batter')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${playerType === 'batter' ? 'bg-white shadow text-blue-800' : 'text-slate-500'}`}>野手</button>
                  <button onClick={() => setPlayerType('pitcher')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${playerType === 'pitcher' ? 'bg-white shadow text-red-800' : 'text-slate-500'}`}>投手</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="p-2 border rounded text-sm" />
                  
                  {/* Opponent Input with Datalist */}
                  <div className="relative">
                      <input 
                        type="text" 
                        list="opponent-list"
                        placeholder="対戦相手 (選択or入力)" 
                        value={opponent} 
                        onChange={(e) => setOpponent(e.target.value)} 
                        className="w-full p-2 border rounded text-sm" 
                      />
                      <datalist id="opponent-list">
                          {opponents.map(op => (
                              <option key={op.id} value={op.name} />
                          ))}
                      </datalist>
                  </div>

                  <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} className="col-span-2 p-2 border rounded font-bold bg-slate-50">
                    <option value="">-- 選手を選択 --</option>
                    {players.filter(p => playerType === 'batter' ? p.type !== 'pitcher' : p.type !== 'batter').map(p => (
                        <option key={p.id} value={p.id}>{p.name} (#{p.number})</option>
                    ))}
                  </select>
              </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
             {playerType === 'batter' ? (
                 <div className="space-y-4">
                     <h3 className="font-bold text-slate-700 flex items-center gap-2"><Zap size={18}/> 入力モード</h3>
                     <div className="flex gap-2">
                        <button onClick={() => setMode('live')} className={`flex-1 py-2 border-2 rounded-lg font-bold text-sm ${mode==='live' ? 'border-team-navy bg-blue-50 text-team-navy' : 'border-slate-100 text-slate-400'}`}>一球速報</button>
                        <button onClick={() => setMode('batch')} className={`flex-1 py-2 border-2 rounded-lg font-bold text-sm ${mode==='batch' ? 'border-team-navy bg-blue-50 text-team-navy' : 'border-slate-100 text-slate-400'}`}>試合後一括</button>
                     </div>
                 </div>
             ) : (
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><Target size={18}/> 投手入力</h3>
                    <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setPStats(p => ({...p, isStarter: true}))} className={`flex-1 py-2 rounded font-bold text-sm transition ${pStats.isStarter ? 'bg-white text-team-navy shadow' : 'text-slate-500'}`}>先発</button>
                        <button onClick={() => setPStats(p => ({...p, isStarter: false}))} className={`flex-1 py-2 rounded font-bold text-sm transition ${!pStats.isStarter ? 'bg-white text-team-navy shadow' : 'text-slate-500'}`}>救援</button>
                    </div>
                </div>
             )}
          </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg animate-in fade-in slide-in-from-bottom-2">
          
          {/* BATTER LIVE */}
          {playerType === 'batter' && mode === 'live' && (
              <div className="space-y-6">
                 {/* Mode Toggle for Scorebook */}
                 <div className="flex justify-end">
                     <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setInputMode('simple')} className={`px-4 py-1 text-xs font-bold rounded-md transition ${inputMode==='simple' ? 'bg-white shadow text-team-navy' : 'text-slate-400'}`}>簡易</button>
                        <button onClick={() => setInputMode('scorebook')} className={`px-4 py-1 text-xs font-bold rounded-md transition ${inputMode==='scorebook' ? 'bg-white shadow text-team-navy' : 'text-slate-400'}`}>スコアブック</button>
                     </div>
                 </div>

                 <div className="flex flex-col md:flex-row justify-between items-center gap-6 pb-4 border-b">
                      <div className="flex items-center gap-4">
                         <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg">
                             <span className="text-sm font-bold text-slate-500">打点</span>
                             <button onClick={()=>setLiveRbi(Math.max(0,liveRbi-1))} className="w-8 h-8 bg-white border rounded shadow-sm">-</button>
                             <span className="font-bold text-2xl w-8 text-center text-team-navy">{liveRbi}</span>
                             <button onClick={()=>setLiveRbi(liveRbi+1)} className="w-8 h-8 bg-blue-50 border-blue-200 text-blue-600 rounded shadow-sm">+</button>
                         </div>
                      </div>
                      
                      {/* Diamond Runner UI */}
                      <div className="relative w-48 h-32 flex items-center justify-center">
                          <div onClick={() => setRunners(r=>({...r, 2: !r[2]}))} className={`absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 rotate-45 border-2 cursor-pointer transition-all ${runners[2] ? 'bg-team-red border-team-red z-20' : 'bg-slate-100 border-slate-300 z-10'}`} />
                          <div onClick={() => setRunners(r=>({...r, 3: !r[3]}))} className={`absolute top-10 left-8 w-10 h-10 rotate-45 border-2 cursor-pointer transition-all ${runners[3] ? 'bg-team-red border-team-red z-20' : 'bg-slate-100 border-slate-300 z-10'}`} />
                          <div onClick={() => setRunners(r=>({...r, 1: !r[1]}))} className={`absolute top-10 right-8 w-10 h-10 rotate-45 border-2 cursor-pointer transition-all ${runners[1] ? 'bg-team-red border-team-red z-20' : 'bg-slate-100 border-slate-300 z-10'}`} />
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-10 h-10 bg-slate-200 clip-path-home flex items-center justify-center text-[10px] font-bold text-slate-400 pt-2" style={{clipPath: 'polygon(50% 100%, 100% 0, 0 0)'}}>HOME</div>
                      </div>
                  </div>

                  {/* SCOREBOOK FIELD UI (Batter) */}
                  {inputMode === 'scorebook' && (
                      <div className="flex flex-col items-center justify-center space-y-2 animate-in fade-in slide-in-from-top-4">
                          <div className="relative w-full max-w-[400px] aspect-square bg-green-700 rounded-lg shadow-inner overflow-hidden cursor-crosshair">
                              <svg width="100%" height="100%" viewBox="0 0 100 100" onClick={handleFieldClick}>
                                  {/* Field Background */}
                                  <rect width="100" height="100" fill="#15803d" />
                                  <line x1="50" y1="85" x2="0" y2="35" stroke="white" strokeWidth="0.5" />
                                  <line x1="50" y1="85" x2="100" y2="35" stroke="white" strokeWidth="0.5" />
                                  <path d="M 50 85 L 75 60 L 50 35 L 25 60 Z" fill="#a36936" stroke="none" opacity="0.8" />
                                  <path d="M 0 35 Q 50 -10 100 35" stroke="white" strokeWidth="0.5" fill="none" />
                                  
                                  {/* Ball Marker */}
                                  {ballCoord && (
                                      <circle cx={ballCoord.x} cy={ballCoord.y} r="2" fill="red" stroke="white" strokeWidth="1" />
                                  )}
                              </svg>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                             <MapPin size={12} />
                             {ballCoord ? `打球位置: (${Math.round(ballCoord.x)}, ${Math.round(ballCoord.y)})` : 'フィールドをタップして打球位置を記録'}
                          </div>
                      </div>
                  )}

                  {/* Direction Input */}
                  <div className="flex items-center gap-2 justify-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-xs font-bold text-slate-500">打球方向</span>
                      <select className="p-2 text-sm font-bold border rounded" value={selectedDirection} onChange={e=>setSelectedDirection(parseInt(e.target.value) as any)}>
                          <option value="0">不明/指定なし</option>
                          <option value="1">投(1)</option>
                          <option value="2">捕(2)</option>
                          <option value="3">一(3)</option>
                          <option value="4">二(4)</option>
                          <option value="5">三(5)</option>
                          <option value="6">遊(6)</option>
                          <option value="7">左(7)</option>
                          <option value="8">中(8)</option>
                          <option value="9">右(9)</option>
                      </select>
                  </div>

                  <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                    <ResultButton res="1B" label="単打" color="bg-red-50 text-red-700" />
                    <ResultButton res="2B" label="二塁打" color="bg-red-50 text-red-700" />
                    <ResultButton res="3B" label="三塁打" color="bg-red-50 text-red-700" />
                    <ResultButton res="HR" label="本塁打" color="bg-red-100 text-red-800" />
                    <ResultButton res="BB" label="四球" color="bg-blue-50 text-blue-700" />
                    <ResultButton res="HBP" label="死球" color="bg-blue-50 text-blue-700" />
                    <ResultButton res="IBB" label="敬遠" color="bg-blue-50 text-blue-700" />
                    <ResultButton res="SO" label="三振" />
                    <ResultButton res="SAC" label="犠打" />
                    <ResultButton res="SF" label="犠飛" />
                    <ResultButton res="GO" label="ゴロ" />
                    <ResultButton res="FO" label="フライ" />
                    <ResultButton res="ROE" label="失策" />
                    <ResultButton res="FC" label="野選" />
                    <ResultButton res="XI" label="妨害" />
                  </div>
                  
                  <button onClick={handleBatterLiveSubmit} className="w-full bg-team-navy text-white py-4 rounded-xl font-bold text-lg shadow">打席を記録</button>
              </div>
          )}

          {/* BATTER BATCH */}
          {playerType === 'batter' && mode === 'batch' && (
             <div className="space-y-6">
                 <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                    <Counter label="打数" val={batchStats.ab} setVal={(v:number)=>setBatchStats(p=>({...p, ab:v}))} colorClass="bg-blue-100"/>
                    <Counter label="安打" val={batchStats.h} setVal={(v:number)=>setBatchStats(p=>({...p, h:v}))} colorClass="bg-red-100"/>
                    <Counter label="打点" val={batchStats.rbi} setVal={(v:number)=>setBatchStats(p=>({...p, rbi:v}))} colorClass="bg-orange-100"/>
                    <Counter label="本塁打" val={batchStats.hr} setVal={(v:number)=>setBatchStats(p=>({...p, hr:v}))} colorClass="bg-red-50"/>
                    <Counter label="四球" val={batchStats.bb} setVal={(v:number)=>setBatchStats(p=>({...p, bb:v}))} />
                    <Counter label="死球" val={batchStats.hbp} setVal={(v:number)=>setBatchStats(p=>({...p, hbp:v}))} />
                    <Counter label="敬遠" val={batchStats.ibb} setVal={(v:number)=>setBatchStats(p=>({...p, ibb:v}))} />
                    <Counter label="三振" val={batchStats.k} setVal={(v:number)=>setBatchStats(p=>({...p, k:v}))} />
                    <Counter label="二塁打" val={batchStats.double} setVal={(v:number)=>setBatchStats(p=>({...p, double:v}))} />
                    <Counter label="三塁打" val={batchStats.triple} setVal={(v:number)=>setBatchStats(p=>({...p, triple:v}))} />
                    <Counter label="犠打" val={batchStats.sac} setVal={(v:number)=>setBatchStats(p=>({...p, sac:v}))} />
                    <Counter label="犠飛" val={batchStats.sf} setVal={(v:number)=>setBatchStats(p=>({...p, sf:v}))} />
                    <Counter label="盗塁" val={batchStats.sb} setVal={(v:number)=>setBatchStats(p=>({...p, sb:v}))} />
                    <Counter label="盗塁死" val={batchStats.cs} setVal={(v:number)=>setBatchStats(p=>({...p, cs:v}))} />
                    <Counter label="併殺" val={batchStats.gidp} setVal={(v:number)=>setBatchStats(p=>({...p, gidp:v}))} />
                    <Counter label="得点" val={batchStats.r} setVal={(v:number)=>setBatchStats(p=>({...p, r:v}))} />
                 </div>
                 <button onClick={handleBatterBatchSubmit} className="w-full bg-team-navy text-white py-4 rounded-xl font-bold text-lg shadow">一括保存</button>
             </div>
          )}

          {/* PITCHER INPUT (FULL UPDATE) */}
          {playerType === 'pitcher' && (
              <div className="space-y-6">
                  {/* Mode Toggle for Scorebook */}
                  <div className="flex justify-end">
                     <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setInputMode('simple')} className={`px-4 py-1 text-xs font-bold rounded-md transition ${inputMode==='simple' ? 'bg-white shadow text-team-navy' : 'text-slate-400'}`}>簡易</button>
                        <button onClick={() => setInputMode('scorebook')} className={`px-4 py-1 text-xs font-bold rounded-md transition ${inputMode==='scorebook' ? 'bg-white shadow text-team-navy' : 'text-slate-400'}`}>被安打マップ</button>
                     </div>
                  </div>

                  {/* Win/Loss */}
                  <div className="flex flex-wrap gap-2 justify-center pb-4 border-b">
                      {(['W','L','SV','HLD', null] as const).map(r => (
                          <button key={r||'none'} onClick={() => setPStats(p => ({...p, result: r}))}
                            className={`px-6 py-2 rounded-full font-bold border transition ${pStats.result === r ? 'bg-team-red text-white border-team-red' : 'text-slate-500 bg-slate-50'}`}
                          >
                              {r === 'W' ? '勝利' : r === 'L' ? '敗戦' : r === 'SV' ? 'セーブ' : r === 'HLD' ? 'ホールド' : '勝敗なし'}
                          </button>
                      ))}
                  </div>

                  {/* SCOREBOOK FIELD UI (PITCHER) */}
                  {inputMode === 'scorebook' && (
                      <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in slide-in-from-top-4 bg-slate-50 p-4 rounded-xl border">
                          <h4 className="font-bold text-slate-600 flex items-center gap-2"><MapPin size={16}/> 被安打・アウトマップ入力</h4>
                          <div className="flex gap-2 w-full max-w-[400px] flex-wrap justify-center">
                              <PitcherSprayButton res="1B" label="単打" />
                              <PitcherSprayButton res="2B" label="二塁打" />
                              <PitcherSprayButton res="3B" label="三塁打" />
                              <PitcherSprayButton res="HR" label="本塁打" />
                              <div className="w-full flex gap-2">
                                <PitcherSprayButton res="GO" label="ゴロ" type="out" />
                                <PitcherSprayButton res="FO" label="フライ" type="out" />
                              </div>
                          </div>
                          <div className="relative w-full max-w-[300px] aspect-square bg-green-700 rounded-lg shadow-inner overflow-hidden cursor-crosshair">
                              <svg width="100%" height="100%" viewBox="0 0 100 100" onClick={handleFieldClick}>
                                  <rect width="100" height="100" fill="#15803d" />
                                  <line x1="50" y1="85" x2="0" y2="35" stroke="white" strokeWidth="0.5" />
                                  <line x1="50" y1="85" x2="100" y2="35" stroke="white" strokeWidth="0.5" />
                                  <path d="M 50 85 L 75 60 L 50 35 L 25 60 Z" fill="#a36936" stroke="none" opacity="0.8" />
                                  <path d="M 0 35 Q 50 -10 100 35" stroke="white" strokeWidth="0.5" fill="none" />
                                  
                                  {/* Current plotted points */}
                                  {pStats.allowed_spray && pStats.allowed_spray.map((d, i) => {
                                      const isOut = ['GO','FO'].includes(d.result);
                                      return (
                                        <circle key={i} cx={d.x} cy={d.y} r="2" fill={isOut ? 'cyan' : 'yellow'} stroke="black" strokeWidth="0.5" />
                                      )
                                  })}
                              </svg>
                          </div>
                          <div className="flex justify-between w-full max-w-[400px] text-xs text-slate-500">
                              <span>※マップをタップすると自動で数字も加算されます</span>
                              <button onClick={handlePitcherUndoSpray} className="flex items-center gap-1 text-red-500 hover:text-red-700 font-bold"><Undo2 size={12}/> 1つ戻す</button>
                          </div>
                      </div>
                  )}

                  {/* Innings & Score */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           <div className="col-span-2 bg-white p-2 rounded flex items-center justify-between px-4 border shadow-sm">
                               <span className="font-bold text-slate-600">投球回</span>
                               <div className="flex items-center gap-2">
                                   <input type="number" min="0" className="w-16 p-2 text-xl text-center font-bold border rounded" value={pStats.ip} onChange={e=>setPStats(p=>({...p, ip: parseInt(e.target.value)||0}))} />
                                   <span className="text-xl font-bold text-slate-400">.</span>
                                   <select className="p-2 text-xl font-bold border rounded" value={pStats.outs_frac} onChange={e=>setPStats(p=>({...p, outs_frac: parseInt(e.target.value) as any}))}>
                                       <option value="0">0</option>
                                       <option value="1">1</option>
                                       <option value="2">2</option>
                                   </select>
                               </div>
                           </div>
                           <Counter label="失点" val={pStats.r} setVal={(v:number)=>setPStats(p=>({...p, r:v}))} colorClass="bg-red-50"/>
                           <Counter label="自責点" val={pStats.er} setVal={(v:number)=>setPStats(p=>({...p, er:v}))} colorClass="bg-red-50"/>
                      </div>
                  </div>

                  {/* Basic Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                       <Counter label="被安打" val={pStats.h} setVal={(v:number)=>setPStats(p=>({...p, h:v}))} />
                       <Counter label="奪三振" val={pStats.k} setVal={(v:number)=>setPStats(p=>({...p, k:v}))} />
                       <Counter label="与四球" val={pStats.bb} setVal={(v:number)=>setPStats(p=>({...p, bb:v}))} />
                       <Counter label="与死球" val={pStats.hbp} setVal={(v:number)=>setPStats(p=>({...p, hbp:v}))} />
                       <Counter label="球数" val={pStats.p_count} setVal={(v:number)=>setPStats(p=>({...p, p_count:v}))} step={10} />
                  </div>

                  {/* Toggle Advanced */}
                  <button onClick={() => setShowDetailPitcher(!showDetailPitcher)} className="w-full flex items-center justify-center gap-2 text-slate-500 text-xs font-bold py-2 bg-slate-50 rounded hover:bg-slate-100">
                      {showDetailPitcher ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} 詳細項目（分析用）を入力
                  </button>

                  {/* Detailed Input Area */}
                  {showDetailPitcher && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                          <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                              <h4 className="text-xs font-bold text-blue-800 mb-2">打球内訳・被長打 (BABIP, 長打率計算用)</h4>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                  <Counter label="被本塁打" val={pStats.hr} setVal={(v:number)=>setPStats(p=>({...p, hr:v}))} colorClass="bg-red-50"/>
                                  <Counter label="被二塁打" val={pStats.h2} setVal={(v:number)=>setPStats(p=>({...p, h2:v}))} />
                                  <Counter label="被三塁打" val={pStats.h3} setVal={(v:number)=>setPStats(p=>({...p, h3:v}))} />
                                  <Counter label="被犠打" val={pStats.sac} setVal={(v:number)=>setPStats(p=>({...p, sac:v}))} />
                                  <Counter label="被犠飛" val={pStats.sf} setVal={(v:number)=>setPStats(p=>({...p, sf:v}))} />
                                  <Counter label="被打数" val={pStats.ab} setVal={(v:number)=>setPStats(p=>({...p, ab:v}))} />
                              </div>
                              <p className="text-[10px] text-blue-400 mt-2">※ 被打数は「打数」です (犠打飛・四死球を含まない)</p>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                              <h4 className="text-xs font-bold text-slate-500 mb-2">その他指標 (GO/AO, 援護, ストッパー)</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <Counter label="ゴロOUT" val={pStats.go} setVal={(v:number)=>setPStats(p=>({...p, go:v}))} />
                                  <Counter label="フライOUT" val={pStats.fo} setVal={(v:number)=>setPStats(p=>({...p, fo:v}))} />
                                  <Counter label="暴投" val={pStats.wild_pitch} setVal={(v:number)=>setPStats(p=>({...p, wild_pitch:v}))} />
                                  <Counter label="敬遠" val={pStats.ibb} setVal={(v:number)=>setPStats(p=>({...p, ibb:v}))} />
                                  
                                  {pStats.isStarter && (
                                      <>
                                        <Counter label="援護点" val={pStats.run_support} setVal={(v:number)=>setPStats(p=>({...p, run_support:v}))} colorClass="bg-orange-50"/>
                                        <Counter label="援護回" val={pStats.support_innings} setVal={(v:number)=>setPStats(p=>({...p, support_innings:v}))} />
                                      </>
                                  )}
                              </div>
                              
                              <div className="flex gap-4 mt-4 pt-4 border-t">
                                  <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                      <input type="checkbox" checked={pStats.stop_win_streak} onChange={e=>setPStats(p=>({...p, stop_win_streak: e.target.checked}))} className="w-5 h-5 rounded text-team-navy"/>
                                      連勝ストップ
                                  </label>
                                  <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                      <input type="checkbox" checked={pStats.stop_loss_streak} onChange={e=>setPStats(p=>({...p, stop_loss_streak: e.target.checked}))} className="w-5 h-5 rounded text-team-navy"/>
                                      連敗ストップ
                                  </label>
                              </div>
                          </div>
                      </div>
                  )}
                  
                  <button onClick={handlePitcherSubmit} className="w-full bg-team-red text-white py-4 rounded-xl font-bold text-lg shadow hover:bg-red-600 transition">
                      投手成績を保存
                  </button>
              </div>
          )}

      </div>
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 fixed bottom-10 right-10 z-50 shadow-xl ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          <AlertCircle size={20} />
          <span className="font-bold">{message.text}</span>
        </div>
      )}
    </div>
  );
};