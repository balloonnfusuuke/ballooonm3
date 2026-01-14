
import React, { useEffect, useState } from 'react';
import { db } from '../services/firebase'; 
import { collection, doc, query, orderBy, limit, onSnapshot, where } from "firebase/firestore";
import { User, Activity, MapPin, Clock, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react'; 
import { LiveGameStatus } from '../types';

export const LiveGameViewer: React.FC = () => {
  const [activeGames, setActiveGames] = useState<LiveGameStatus[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveGameStatus | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. 進行中の試合リストを取得
  useEffect(() => {
    setIsLoading(true);
    // 今日以降の試合、または最近更新された試合を取得するロジック
    const q = query(collection(db, "live_games"));
    const unsub = onSnapshot(q, (snap) => {
      const games = snap.docs.map(d => d.data() as LiveGameStatus);
      // 更新日時が新しい順
      const sortedGames = games.sort((a,b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || ""));
      setActiveGames(sortedGames);
      setIsLoading(false);
      
      // 1試合しかなければ自動選択 (初回のみ)
      if (sortedGames.length === 1 && !selectedGameId) {
        setSelectedGameId(sortedGames[0].gameId);
      }
    }, (error) => {
      console.error("Error fetching live games:", error);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. 選択された試合の詳細（実況）を監視
  useEffect(() => {
    if (!selectedGameId) return;

    setLogs([]); // Reset logs on change
    
    // A. 現在の状況（ランナー、カウントなど）の監視
    const unsubStatus = onSnapshot(doc(db, "live_games", selectedGameId), (doc) => {
      if (doc.exists()) {
        setLiveStatus(doc.data() as LiveGameStatus);
      }
    });

    // B. 試合ログ（打席結果）の監視
    // Note: 複合インデックスエラーを避けるため、クライアントサイドでソートします
    const qLogs = query(
      collection(db, "pa_records"),
      where("gameId", "==", selectedGameId)
    );
    
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const fetchedLogs = snap.docs.map(d => d.data());
      
      // クライアントサイドソート (createdAtがないデータにも対応)
      const sorted = fetchedLogs.sort((a: any, b: any) => {
          // 1. 作成日時がある場合（新しい順）
          if (a.createdAt && b.createdAt) {
              return b.createdAt.localeCompare(a.createdAt);
          }
          // 2. なければイニング順（大きい方が新しいと仮定）
          if (a.inning !== b.inning) {
              return b.inning - a.inning;
          }
          // 3. それでも同じならIDなどで安定ソート
          return (b.id || "").localeCompare(a.id || "");
      });
      setLogs(sorted.slice(0, 50));
    }, (error) => {
      console.error("Error fetching logs:", error);
    });

    return () => {
      unsubStatus();
      unsubLogs();
    };
  }, [selectedGameId]);

  if (!selectedGameId) {
    return (
      <div className="p-4 bg-slate-100 min-h-screen">
        <h1 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Activity className="text-red-500"/> ライブ試合一覧</h1>
        
        {isLoading && <p className="text-slate-500 p-4">読み込み中...</p>}

        {!isLoading && activeGames.length === 0 && (
          <div className="text-slate-500 bg-white p-8 rounded-xl border border-dashed text-center">
            <p className="mb-2 font-bold">現在進行中の試合はありません</p>
            <p className="text-xs">入力画面で「試合開始」し、データを入力をするとここに表示されます。</p>
          </div>
        )}

        <div className="space-y-3">
          {activeGames.map(g => (
            <button key={g.gameId} onClick={() => setSelectedGameId(g.gameId)} className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-left hover:bg-blue-50 transition active:scale-[0.98]">
              <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-lg text-team-navy line-clamp-1">{g.opponent} 戦</span>
                  <span className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold animate-pulse whitespace-nowrap">LIVE</span>
              </div>
              <div className="text-slate-500 text-sm font-mono flex items-center gap-2">
                  <span className="bg-slate-100 px-2 py-0.5 rounded">{g.date}</span>
                  <span>{g.inning}回{g.isTop?'表':'裏'}</span>
                  <span className="font-bold text-slate-800 ml-auto text-lg">{g.score.my} - {g.score.opp}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!liveStatus) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
          <div className="text-slate-400 mb-4">データを読み込んでいます...</div>
          <button onClick={() => setSelectedGameId(null)} className="text-blue-600 underline text-sm">戻る</button>
      </div>
  );

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen pb-20 border-x border-slate-200 shadow-2xl overflow-hidden relative">
      {/* ヘッダー: スコアボード */}
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setSelectedGameId(null)} className="text-slate-400 hover:text-white transition flex items-center gap-1 text-xs font-bold bg-white/10 px-2 py-1 rounded">
                <ArrowLeft size={12}/> 一覧へ
            </button>
            <span className="text-xs text-slate-400 truncate flex-1 text-right">{liveStatus.date} vs {liveStatus.opponent}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold font-mono text-white leading-none">{liveStatus.inning}</span>
              <span className="text-sm font-bold text-slate-300">{liveStatus.isTop ? '表' : '裏'}</span>
            </div>
          </div>
          
          {/* スコア */}
          <div className="flex items-center gap-4 text-3xl font-bold font-mono bg-black/30 px-6 py-2 rounded-lg border border-white/10 backdrop-blur-sm">
            <span className={liveStatus.currentSide === 'Attack' ? 'text-yellow-400' : 'text-white'}>{liveStatus.score.my}</span>
            <span className="text-slate-500 text-xl">-</span>
            <span className={liveStatus.currentSide === 'Defense' ? 'text-yellow-400' : 'text-white'}>{liveStatus.score.opp}</span>
          </div>

          {/* カウント */}
          <div className="flex flex-col items-end">
             <div className="flex gap-1.5 mb-1">
                {[1,2].map(o => (
                  <div key={o} className={`w-3 h-3 rounded-full shadow-sm transition-all duration-300 ${liveStatus.outs >= o ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] scale-110' : 'bg-slate-700'}`} />
                ))}
             </div>
             <span className="text-[10px] font-bold text-slate-400 tracking-widest">OUT</span>
          </div>
        </div>
      </header>

      {/* グラウンド・ダイヤモンド表示 */}
      <div className="bg-gradient-to-b from-green-800 to-green-700 p-6 relative flex justify-center h-64 shadow-inner overflow-hidden">
          {/* ダイヤモンドの描画 (CSS) */}
          <div className="relative w-36 h-36 mt-8 rotate-45 transform scale-125">
              {/* ベースライン */}
              <div className="absolute inset-0 border-2 border-white/30 box-border"></div>
              
              {/* 2塁 */}
              <div className={`absolute -top-3 -right-3 w-7 h-7 border-2 transition-all duration-500 z-10 ${liveStatus.runners.second ? 'bg-yellow-400 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,1)] scale-110' : 'bg-white/10 border-white/30'}`}></div>
              {/* 3塁 */}
              <div className={`absolute -top-3 -left-3 w-7 h-7 border-2 transition-all duration-500 z-10 ${liveStatus.runners.third ? 'bg-yellow-400 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,1)] scale-110' : 'bg-white/10 border-white/30'}`}></div>
              {/* 1塁 */}
              <div className={`absolute -bottom-3 -right-3 w-7 h-7 border-2 transition-all duration-500 z-10 ${liveStatus.runners.first ? 'bg-yellow-400 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,1)] scale-110' : 'bg-white/10 border-white/30'}`}></div>
              {/* 本塁 */}
              <div className="absolute -bottom-3 -left-3 w-7 h-7 bg-white/20 border-white/30 clip-path-home z-10"></div>
          </div>

          {/* 打者・投手情報 */}
          <div className="absolute bottom-3 left-3 text-white text-xs z-10 bg-black/20 p-2 rounded-lg backdrop-blur-sm border border-white/10">
             <div className="flex items-center gap-1 mb-1 text-slate-300 font-bold uppercase tracking-wider text-[10px]"><User size={10}/> Batter</div>
             <div className="font-bold text-lg leading-none text-white drop-shadow-md">{liveStatus.batter?.name || '---'}</div>
             {liveStatus.batter?.number && <div className="text-[10px] opacity-70 mt-0.5">#{liveStatus.batter.number}</div>}
          </div>
          <div className="absolute bottom-3 right-3 text-white text-xs text-right z-10 bg-black/20 p-2 rounded-lg backdrop-blur-sm border border-white/10">
             <div className="flex items-center justify-end gap-1 mb-1 text-slate-300 font-bold uppercase tracking-wider text-[10px]">Pitcher <Activity size={10}/></div>
             <div className="font-bold text-lg leading-none text-white drop-shadow-md">{liveStatus.pitcher?.name || '---'}</div>
             {liveStatus.pitcher?.number && <div className="text-[10px] opacity-70 mt-0.5">#{liveStatus.pitcher.number}</div>}
          </div>
      </div>

      {/* 試合ログ（タイムライン） */}
      <div className="p-4 space-y-3 bg-slate-50 min-h-[300px]">
        <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-500 text-xs flex items-center gap-1 uppercase tracking-wider"><Clock size={14}/> Play by Play</h3>
            <span className="text-[10px] text-slate-400 bg-white px-2 py-1 rounded border">Auto Syncing</span>
        </div>
        
        {logs.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-10 bg-white rounded-xl border border-dashed flex flex-col items-center gap-2">
              <AlertTriangle size={20} className="opacity-50"/>
              <span>まだ記録がありません</span>
          </p>
        ) : (
          logs.map((log: any) => (
            <div key={log.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center animate-in slide-in-from-top-2 fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center bg-slate-100 w-10 h-10 rounded-lg shrink-0 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-600 leading-none">{log.inning}</span>
                    <span className="text-[9px] font-bold text-slate-400 leading-none mt-0.5">{log.isTop?'表':'裏'}</span>
                </div>
                <div>
                    <div className="font-bold text-slate-800 text-sm line-clamp-1">{log.playerName}</div>
                    <div className="flex gap-2 text-[10px] mt-0.5">
                        {log.rbi > 0 && <span className="text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">+{log.rbi}点</span>}
                        {log.runScored > 0 && <span className="text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">失点{log.runScored}</span>}
                    </div>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-block px-3 py-1.5 rounded-lg font-bold text-sm shadow-sm border ${getResultColor(log.result)}`}>
                  {log.result}
                </span>
                {log.isSteal && <div className="text-[10px] text-green-600 font-bold mt-1 text-right flex justify-end items-center gap-1"><Activity size={10}/> 盗塁</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const getResultColor = (res: string) => {
  if (['1B','2B','3B','HR'].includes(res)) return 'bg-red-50 text-red-600 border-red-100';
  if (['BB','IBB','HBP'].includes(res)) return 'bg-blue-50 text-blue-600 border-blue-100';
  if (['SO'].includes(res)) return 'bg-slate-100 text-slate-500 border-slate-200';
  return 'bg-white text-slate-700 border-slate-200';
};
