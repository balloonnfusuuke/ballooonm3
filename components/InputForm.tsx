
import React, { useState, useEffect } from 'react';
import { Player, PlateAppearance, ResultType, PositionNum, GameBatchRecord, PitcherGameRecord, Opponent, PitcherPlayRecord } from '../types';
import { getPlayers, getOpponents, savePARecord, saveBatchRecord, savePitcherRecord, savePitcherPlayRecord, generateUUID, savePlayer, getPARecords, getPitcherPlayRecords } from '../services/dataService';
import { AlertCircle, Plus, Minus, Zap, User, Target, ChevronDown, ChevronUp, MapPin, Undo2, Calendar, ClipboardList, Activity, X, MoveRight, UserMinus, Play, RotateCw, Users, Shield, Edit3, Save, HelpCircle, Info, CheckCircle2, AlertTriangle, FileText, Download, Copy, RefreshCcw, LogOut, UserPlus, ArrowLeftRight, Share2 } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

type PitcherBatchFormState = Partial<PitcherGameRecord> & {
  ip: number;
  outs_frac: 0 | 1 | 2;
  allowed_spray: Array<{x: number, y: number, result: string}>;
};

type BaseLocation = 'batter' | '1B' | '2B' | '3B' | 'Home' | 'Out' | 'None';
interface RunnerState {
    originalBase: 'batter' | 'runner1' | 'runner2' | 'runner3';
    playerId: string;
    playerName: string;
    dest: BaseLocation;
    isOut: boolean;
    isRun: boolean;
}

const SESSION_STORAGE_KEY = 'indieball_live_session';

interface InputFormProps {
    isVisible: boolean;
}

export const InputForm: React.FC<InputFormProps> = ({ isVisible }) => {
  const [tab, setTab] = useState<'live' | 'batch_batter' | 'batch_pitcher'>('live');
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [opponent, setOpponent] = useState<string>(''); 
  const [currentOpponentId, setCurrentOpponentId] = useState<string>('');

  const [gamePhase, setGamePhase] = useState<'setup' | 'playing'>('setup');
  const [setupTab, setSetupTab] = useState<'my' | 'opp'>('my');
  
  // Lineup IDs
  const [myLineup, setMyLineup] = useState<string[]>(Array(9).fill('')); 
  const [opponentLineupIds, setOpponentLineupIds] = useState<string[]>(Array(9).fill('')); 
  const [myLineupPositions, setMyLineupPositions] = useState<string[]>(Array(9).fill(''));
  const [opponentLineupPositions, setOpponentLineupPositions] = useState<string[]>(Array(9).fill(''));

  const [currentBatterIndex, setCurrentBatterIndex] = useState<number>(0); 
  const [currentOppBatterIndex, setCurrentOppBatterIndex] = useState<number>(0);
  
  // Pitcher Selection
  const [selectedPitcherId, setSelectedPitcherId] = useState<string>(''); // My Team Pitcher
  const [currentOppPitcherId, setCurrentOppPitcherId] = useState<string>(''); // Opponent Pitcher ID (or generic)

  const [newOppPlayerName, setNewOppPlayerName] = useState('');
  const [newOppPlayerNumber, setNewOppPlayerNumber] = useState('');

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

  const [gameState, setGameState] = useState<{
      inning: number;
      topBottom: 'Top' | 'Bot';
      outs: number;
      runner1: boolean;
      runner2: boolean;
      runner3: boolean;
      runner1Id: string | null;
      runner2Id: string | null;
      runner3Id: string | null;
      currentSide: 'Attack' | 'Defense';
  }>({
      inning: 1, topBottom: 'Top', outs: 0, 
      runner1: false, runner2: false, runner3: false,
      runner1Id: null, runner2Id: null, runner3Id: null,
      currentSide: 'Attack'
  });

  const [currentScore, setCurrentScore] = useState<{my: number, opp: number}>({my: 0, opp: 0});

  const [liveRbi, setLiveRbi] = useState<number>(0);
  const [liveRunScored, setLiveRunScored] = useState<number>(0); 
  const [liveER, setLiveER] = useState<number>(0);
  
  const [selectedResult, setSelectedResult] = useState<ResultType | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<PositionNum>(0); 
  const [ballCoord, setBallCoord] = useState<{x: number, y: number} | null>(null);

  // Modals
  const [runnerModal, setRunnerModal] = useState<{ isOpen: boolean, base: 'runner1' | 'runner2' | 'runner3' | null }>({ isOpen: false, base: null });
  const [phModalOpen, setPhModalOpen] = useState(false);
  const [oppPhModalOpen, setOppPhModalOpen] = useState(false);
  const [oppLineupModalOpen, setOppLineupModalOpen] = useState(false);
  const [myLineupModalOpen, setMyLineupModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false); 
  
  const [reviewModal, setReviewModal] = useState<{
      isOpen: boolean;
      result: ResultType | null;
      runners: RunnerState[];
  }>({ isOpen: false, result: null, runners: [] });

  // Batch States
  const [batchStats, setBatchStats] = useState({
    ab: 0, h: 0, double: 0, triple: 0, hr: 0,
    bb: 0, ibb: 0, hbp: 0, k: 0, sf: 0, sac: 0, r: 0, rbi: 0,
    sb: 0, cs: 0, gidp: 0
  });

  const [pitcherBatchSprayType, setPitcherBatchSprayType] = useState<'1B'|'2B'|'3B'|'HR'|'GO'|'FO'>('1B');
  const [pStats, setPStats] = useState<PitcherBatchFormState>({
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

  // Initial Load
  useEffect(() => {
    setPlayers(getPlayers());
    setOpponents(getOpponents());
    
    // Restore Session
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
        try {
            const s = JSON.parse(saved);
            if (s.date) setDate(s.date);
            if (s.opponent) setOpponent(s.opponent);
            if (s.currentOpponentId) setCurrentOpponentId(s.currentOpponentId);
            if (s.myLineup) setMyLineup(s.myLineup);
            if (s.opponentLineupIds) setOpponentLineupIds(s.opponentLineupIds);
            if (s.myLineupPositions) setMyLineupPositions(s.myLineupPositions);
            if (s.opponentLineupPositions) setOpponentLineupPositions(s.opponentLineupPositions);
            
            if (s.gamePhase) setGamePhase(s.gamePhase);
            if (s.gameState) setGameState(s.gameState);
            
            if (s.currentBatterIndex !== undefined) setCurrentBatterIndex(s.currentBatterIndex);
            if (s.currentOppBatterIndex !== undefined) setCurrentOppBatterIndex(s.currentOppBatterIndex);
            if (s.selectedPitcherId) setSelectedPitcherId(s.selectedPitcherId);
            if (s.currentOppPitcherId) setCurrentOppPitcherId(s.currentOppPitcherId);
            
            if (s.liveRbi) setLiveRbi(s.liveRbi);
            if (s.liveRunScored) setLiveRunScored(s.liveRunScored);
            if (s.liveER) setLiveER(s.liveER);
            
            showMessage('success', '前回の中断箇所から復帰しました');
        } catch(e) {
            console.error("Failed to restore session", e);
        }
    }
  }, []);

  // Reload data when becoming visible
  useEffect(() => {
      if (isVisible) {
          setPlayers(getPlayers());
          setOpponents(getOpponents());
      }
  }, [isVisible]);

  useEffect(() => {
      if (gamePhase === 'playing' || (gamePhase === 'setup' && opponent)) {
          const session = {
              date, opponent, currentOpponentId,
              myLineup, opponentLineupIds,
              myLineupPositions, opponentLineupPositions,
              gamePhase, gameState,
              currentBatterIndex, currentOppBatterIndex, selectedPitcherId, currentOppPitcherId,
              liveRbi, liveRunScored, liveER
          };
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      }
  }, [
      gamePhase, date, opponent, currentOpponentId, myLineup, opponentLineupIds, myLineupPositions, opponentLineupPositions,
      gameState, currentBatterIndex, currentOppBatterIndex, selectedPitcherId, currentOppPitcherId,
      liveRbi, liveRunScored, liveER
  ]);

  useEffect(() => {
      const found = opponents.find(o => o.name === opponent);
      setCurrentOpponentId(found ? found.id : '');
  }, [opponent, opponents]);

  useEffect(() => {
      if (tab === 'live' && opponent) {
          const gameId = `${date}-${opponent}`;
          const paRecs = getPARecords().filter(r => r.gameId === gameId && r.opponent !== 'My Team');
          const pPlayRecs = getPitcherPlayRecords().filter(r => r.gameId === gameId);
          const myScore = paRecs.reduce((sum, r) => sum + r.rbi, 0);
          const oppScore = pPlayRecs.reduce((sum, r) => sum + (r.runScored || 0), 0);
          setCurrentScore({ my: myScore, opp: oppScore });
      }
  }, [tab, date, opponent, gameState, selectedResult]);

  const executeResetGame = () => {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setGamePhase('setup');
      setOpponent(''); // Clear opponent
      setCurrentOpponentId(''); // Clear opponent ID
      setGameState({
          inning: 1, topBottom: 'Top', outs: 0, 
          runner1: false, runner2: false, runner3: false,
          runner1Id: null, runner2Id: null, runner3Id: null,
          currentSide: 'Attack'
      });
      setCurrentBatterIndex(0); setCurrentOppBatterIndex(0);
      setLiveRbi(0); setLiveRunScored(0); setLiveER(0);
      setMyLineup(Array(9).fill('')); setOpponentLineupIds(Array(9).fill(''));
      setMyLineupPositions(Array(9).fill('')); setOpponentLineupPositions(Array(9).fill(''));
      setResetModalOpen(false);
      showMessage('success', 'リセットしました');
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const validateCommon = () => {
    if (!opponent) { showMessage('error', '対戦相手を入力してください'); return false; }
    return true;
  };

  const myTeamPlayers = players.filter(p => !p.teamId);
  const opponentPlayers = currentOpponentId ? players.filter(p => p.teamId === currentOpponentId) : [];

  const getRunnerName = (id: string | null) => {
    if (!id) return "";
    const p = players.find(p => p.id === id);
    if (p) return `${p.name} ${p.number ? '#'+p.number : ''}`;
    return "不明";
  };

  const handleBaseClick = (base: 'runner1' | 'runner2' | 'runner3') => { setRunnerModal({ isOpen: true, base }); };

  // Enhanced Lineup Change with Position
  const handleLineupChange = (index: number, playerId: string) => {
      const newLineup = [...myLineup];
      newLineup[index] = playerId;
      setMyLineup(newLineup);
      
      // Auto-set default position if available
      const p = players.find(player => player.id === playerId);
      if (p) {
          const newPos = [...myLineupPositions];
          newPos[index] = p.position || '';
          setMyLineupPositions(newPos);
      }
  };

  const handleLineupPositionChange = (index: number, pos: string) => {
      const newPos = [...myLineupPositions];
      newPos[index] = pos;
      setMyLineupPositions(newPos);
  };

  const handleOpponentLineupChange = (index: number, playerId: string) => {
      const newLineup = [...opponentLineupIds];
      newLineup[index] = playerId;
      setOpponentLineupIds(newLineup);

      const p = players.find(player => player.id === playerId);
      if (p) {
          const newPos = [...opponentLineupPositions];
          newPos[index] = p.position || '';
          setOpponentLineupPositions(newPos);
      }
  };

  const handleOpponentLineupPositionChange = (index: number, pos: string) => {
      const newPos = [...opponentLineupPositions];
      newPos[index] = pos;
      setOpponentLineupPositions(newPos);
  };

  const handleStartGame = () => {
      if (!opponent) { showMessage('error', '対戦相手を入力してください'); return; }
      if (!currentOpponentId && !confirm('対戦相手がリストに登録されていません。相手選手の成績は保存されませんがよろしいですか？')) return;
      setGamePhase('playing');
      showMessage('success', '試合開始！');
  };

  const getBatterInLineup = (offset: number = 0) => {
      const idx = (currentBatterIndex + offset) % 9;
      const pid = myLineup[idx];
      return players.find(p => p.id === pid);
  };

  const getOpponentBatter = (offset: number = 0) => {
      const idx = (currentOppBatterIndex + offset) % 9;
      const pid = opponentLineupIds[idx];
      return players.find(p => p.id === pid) || { id: `unknown-${idx}`, name: `相手${idx+1}番`, number: '' } as Player;
  };

  const handlePinchHit = (newPlayerId: string) => {
      const newLineup = [...myLineup];
      newLineup[currentBatterIndex] = newPlayerId;
      setMyLineup(newLineup);
      
      const p = players.find(pl => pl.id === newPlayerId);
      if (p) {
          const newPos = [...myLineupPositions];
          newPos[currentBatterIndex] = 'PH';
          setMyLineupPositions(newPos);
      }
      setPhModalOpen(false);
      showMessage('success', `代打: ${p?.name}`);
  };

  const handleOppPinchHit = (newPlayerId: string) => {
      const newLineup = [...opponentLineupIds];
      newLineup[currentOppBatterIndex] = newPlayerId;
      setOpponentLineupIds(newLineup);
      
      const p = players.find(pl => pl.id === newPlayerId);
      if (p) {
          const newPos = [...opponentLineupPositions];
          newPos[currentOppBatterIndex] = 'PH';
          setOpponentLineupPositions(newPos);
      }
      setOppPhModalOpen(false);
      showMessage('success', `相手代打: ${p?.name}`);
  };

  const handleQuickAddOpponentPlayer = () => {
      if (!newOppPlayerName || !currentOpponentId) return;
      const newP: Player = { id: generateUUID(), name: newOppPlayerName, number: newOppPlayerNumber, position: 'Unk', type: 'batter', teamId: currentOpponentId, throws: 'R', bats: 'R' };
      savePlayer(newP); setPlayers(getPlayers()); setNewOppPlayerName(''); setNewOppPlayerNumber(''); showMessage('success', '選手を追加しました');
  };
  const getPlayerMiniStats = (playerId: string) => {
      if (!playerId || playerId.startsWith('unknown')) return null;
      const records = getPARecords().filter(r => r.playerId === playerId);
      if (records.length === 0) return null;
      let h=0, ab=0, sb=0;
      records.forEach(r => { if (['1B','2B','3B','HR'].includes(r.result)) { h++; ab++; } else if (['SO','GO','FO','ROE','FC','GIDP'].includes(r.result)) { ab++; } if (r.isSteal) sb++; });
      const avg = ab > 0 ? (h/ab).toFixed(3) : '.---';
      return { avg, sb, h, ab };
  };
  const handleChangeSide = () => {
      setGameState(prev => {
          const nextSide = prev.currentSide === 'Attack' ? 'Defense' : 'Attack';
          let nextTopBottom = prev.topBottom; let nextInning = prev.inning;
          if (prev.topBottom === 'Top') { nextTopBottom = 'Bot'; } else { nextTopBottom = 'Top'; nextInning = prev.inning + 1; }
          return { ...prev, outs: 0, runner1: false, runner2: false, runner3: false, runner1Id: null, runner2Id: null, runner3Id: null, currentSide: nextSide, topBottom: nextTopBottom, inning: nextInning };
      });
      showMessage('success', 'チェンジ（攻守交替）');
  };
  
  const handleRunnerAction = (action: 'SB' | 'CS' | 'Pickoff' | 'Advance' | 'Clear' | 'Change', newPlayerId?: string) => {
      const base = runnerModal.base; if (!base) return; const currentRunnerId = gameState[`${base}Id` as keyof typeof gameState] as string | null; const runnerName = getRunnerName(currentRunnerId); const gameId = `${date}-${opponent}`;
      if (action === 'Change' && newPlayerId !== undefined) {
          const oldPlayerId = gameState[`${base}Id` as keyof typeof gameState]; setGameState(prev => ({ ...prev, [`${base}Id`]: newPlayerId }));
          if (gameState.currentSide === 'Attack') { const lineupIdx = myLineup.findIndex(id => id === oldPlayerId); if (lineupIdx >= 0) { const newLineup = [...myLineup]; newLineup[lineupIdx] = newPlayerId; setMyLineup(newLineup); } } 
          else { const lineupIdx = opponentLineupIds.findIndex(id => id === oldPlayerId); if (lineupIdx >= 0) { const newLineup = [...opponentLineupIds]; newLineup[lineupIdx] = newPlayerId; setOpponentLineupIds(newLineup); } }
          setRunnerModal({ isOpen: false, base: null }); return;
      }
      if (action === 'Clear') { setGameState(prev => ({ ...prev, [base]: false, [`${base}Id`]: null })); setRunnerModal({ isOpen: false, base: null }); return; }
      if (action === 'Advance') { setGameState(prev => { const next = { ...prev }; next[base] = false; (next as any)[`${base}Id`] = null; let target: 'runner2' | 'runner3' | null = null; if (base === 'runner1') target = 'runner2'; if (base === 'runner2') target = 'runner3'; if (target) { next[target] = true; (next as any)[`${target}Id`] = currentRunnerId; } return next; }); showMessage('success', `${runnerName}: 進塁しました`); setRunnerModal({ isOpen: false, base: null }); return; }
      if (!currentRunnerId) { showMessage('error', '先に走者を選択してください'); return; }
      if (action === 'SB') { const record: PlateAppearance = { id: generateUUID(), gameId, date, opponent, playerId: currentRunnerId, playerName: runnerName, inning: gameState.inning, isTop: gameState.topBottom === 'Top', runner1: gameState.runner1, runner2: gameState.runner2, runner3: gameState.runner3, result: 'XI', direction: 0, rbi: 0, isSteal: true, coordX: 0, coordY: 0 }; savePARecord(record); setGameState(prev => { const next = { ...prev }; next[base] = false; (next as any)[`${base}Id`] = null; let target: 'runner2' | 'runner3' | null = null; if (base === 'runner1') target = 'runner2'; if (base === 'runner2') target = 'runner3'; if (target) { next[target] = true; (next as any)[`${target}Id`] = currentRunnerId; } return next; }); showMessage('success', `${runnerName}: 盗塁成功`); }
      if (action === 'CS') { const record: PlateAppearance = { id: generateUUID(), gameId, date, opponent, playerId: currentRunnerId, playerName: runnerName, inning: gameState.inning, isTop: gameState.topBottom === 'Top', runner1: gameState.runner1, runner2: gameState.runner2, runner3: gameState.runner3, result: 'XI', direction: 0, rbi: 0, isSteal: false, coordX: 0, coordY: 0 }; savePARecord(record); setGameState(prev => ({ ...prev, [base]: false, [`${base}Id`]: null, outs: Math.min(2, prev.outs + 1) })); showMessage('success', `${runnerName}: 盗塁死 (アウト+1)`); if (gameState.outs + 1 >= 3) handleChangeSide(); }
      if (action === 'Pickoff') { setGameState(prev => ({ ...prev, [base]: false, [`${base}Id`]: null, outs: Math.min(2, prev.outs + 1) })); showMessage('success', `${runnerName}: 牽制死 (アウト+1)`); if (gameState.outs + 1 >= 3) handleChangeSide(); }
      setRunnerModal({ isOpen: false, base: null });
  };
  const openReviewModal = (res: ResultType) => {
      const runners: RunnerState[] = []; let batterId = '', batterName = ''; if (gameState.currentSide === 'Attack') { const b = getBatterInLineup(0); if(b) { batterId = b.id; batterName = b.name; } } else { const b = getOpponentBatter(0); if(b) { batterId = b.id; batterName = b.name; } }
      let batterDest: BaseLocation = 'None'; 
      if (res === '1B' || res === 'ROE' || res === 'FC') batterDest = '1B'; 
      if (res === '2B') batterDest = '2B'; 
      if (res === '3B') batterDest = '3B'; 
      if (res === 'HR') batterDest = 'Home'; 
      if (res === 'BB' || res === 'IBB' || res === 'HBP') batterDest = '1B'; 
      if (res === 'SAC' || res === 'SF') batterDest = 'Out';
      if (res === 'GIDP') batterDest = 'Out'; 

      if (batterDest !== 'None') { runners.push({ originalBase: 'batter', playerId: batterId, playerName: batterName, dest: batterDest, isOut: batterDest === 'Out', isRun: batterDest === 'Home' }); }
      
      const processRunner = (base: 'runner1'|'runner2'|'runner3', id: string|null, defaultAdv: number) => { 
          if (id) { 
              let dest: BaseLocation = 'None'; 
              const baseNum = base === 'runner1' ? 1 : base === 'runner2' ? 2 : 3; 
              
              if (res === 'GIDP') {
                  if (base === 'runner1') dest = 'Out'; 
                  else if (base === 'runner2') dest = 'Out'; 
                  else if (base === 'runner3') dest = 'Home'; 
                  else dest = base === 'runner1'?'1B':base==='runner2'?'2B':'3B';
              } else {
                  let targetNum = baseNum; 
                  if (['1B','ROE','FC', 'SAC'].includes(res)) targetNum += 1; 
                  else if (res === '2B') targetNum += 2; 
                  else if (res === '3B') targetNum += 3; 
                  else if (res === 'HR') targetNum = 4; 
                  else if (['BB','IBB','HBP'].includes(res)) { 
                      if (base === 'runner1') targetNum += 1; 
                      else if (base === 'runner2') { if (gameState.runner1) targetNum += 1; } 
                      else if (base === 'runner3') { if (gameState.runner1 && gameState.runner2) targetNum += 1; } 
                  } else if (res === 'SF') { 
                      if (baseNum === 3) targetNum = 4; 
                  } 
                  if (targetNum >= 4) dest = 'Home'; 
                  else if (targetNum === 3) dest = '3B'; 
                  else if (targetNum === 2) dest = '2B'; 
                  else if (targetNum === 1) dest = '1B'; 
                  else dest = base === 'runner1'?'1B':base==='runner2'?'2B':'3B'; 
              }

              runners.push({ originalBase: base, playerId: id, playerName: getRunnerName(id), dest: dest, isOut: dest === 'Out', isRun: dest === 'Home' }); 
            } 
        };
      processRunner('runner3', gameState.runner3Id, 0); processRunner('runner2', gameState.runner2Id, 0); processRunner('runner1', gameState.runner1Id, 0);
      setReviewModal({ isOpen: true, result: res, runners });
  };
  const handleReviewChange = (idx: number, field: keyof RunnerState, value: any) => { setReviewModal(prev => { const nextRunners = [...prev.runners]; nextRunners[idx] = { ...nextRunners[idx], [field]: value }; if (field === 'dest') { if (value === 'Out') { nextRunners[idx].isOut = true; nextRunners[idx].isRun = false; } else if (value === 'Home') { nextRunners[idx].isOut = false; nextRunners[idx].isRun = true; } else { nextRunners[idx].isOut = false; nextRunners[idx].isRun = false; } } return { ...prev, runners: nextRunners }; }); };
  const confirmReview = () => { if (!reviewModal.result) return; let addedRuns = 0; let addedOuts = 0; const nextGameState = { ...gameState }; nextGameState.runner1 = false; nextGameState.runner1Id = null; nextGameState.runner2 = false; nextGameState.runner2Id = null; nextGameState.runner3 = false; nextGameState.runner3Id = null; reviewModal.runners.forEach(r => { if (r.isOut) { addedOuts++; } else if (r.dest === 'Home') { addedRuns++; } else { if (r.dest === '1B') { nextGameState.runner1 = true; nextGameState.runner1Id = r.playerId; } if (r.dest === '2B') { nextGameState.runner2 = true; nextGameState.runner2Id = r.playerId; } if (r.dest === '3B') { nextGameState.runner3 = true; nextGameState.runner3Id = r.playerId; } } }); nextGameState.outs += addedOuts; commitPlay(reviewModal.result, nextGameState, addedRuns); setReviewModal({ isOpen: false, result: null, runners: [] }); };
  const commitPlay = (res: ResultType, nextState: typeof gameState, runsFromRunners: number) => { 
      const gameId = `${date}-${opponent}`; 
      let currentPlayerId = '', currentPlayerName = ''; 
      
      // Determine Player ID
      if (gameState.currentSide === 'Attack') { 
          const b = getBatterInLineup(0); 
          if(b) { currentPlayerId=b.id; currentPlayerName=b.name; } 
      } else { 
          const b = getOpponentBatter(0); 
          if(b) { currentPlayerId=b.id; currentPlayerName=b.name; } 
      } 
      
      // Handle Score State
      if (gameState.currentSide === 'Defense') { setLiveRunScored(prev => prev + runsFromRunners); } 
      else { if (runsFromRunners > 0) { setLiveRbi(prev => prev + runsFromRunners); } } 
      
      const rbiToSave = (gameState.currentSide === 'Attack' && runsFromRunners > 0) ? liveRbi + runsFromRunners : liveRbi; 
      const runsToSave = (gameState.currentSide === 'Defense') ? liveRunScored + runsFromRunners : liveRunScored; 
  
      if (gameState.currentSide === 'Attack') { 
          // Detect Opponent Pitcher Hand (for batter split stats)
          let vsHand: 'R' | 'L' | undefined = undefined;
          if (currentOppPitcherId) {
              const oppP = players.find(p => p.id === currentOppPitcherId);
              if (oppP) vsHand = oppP.throws;
          }
          if (!vsHand) vsHand = 'R'; // Default to Righty if unknown

          const record: PlateAppearance = { 
              id: generateUUID(), gameId, date, opponent, playerId: currentPlayerId, playerName: currentPlayerName, inning: gameState.inning, isTop: gameState.topBottom === 'Top', 
              runner1: gameState.runner1, runner2: gameState.runner2, runner3: gameState.runner3, 
              result: res, direction: selectedDirection || 0, rbi: rbiToSave, isSteal: false, coordX: ballCoord?.x, coordY: ballCoord?.y,
              vsHand: vsHand // Saved handedness of opponent pitcher
          }; 
          savePARecord(record); showMessage('success', `【攻撃】${currentPlayerName}: ${res}`); 
          if (!['XI', 'WP', 'BK'].includes(res)) setCurrentBatterIndex(prev => (prev + 1) % 9); 
      } else { 
          // Detect Opponent Batter Hand (for pitcher split stats)
          // Logic: If Switch, check My Pitcher Hand.
          let vsHand: 'R' | 'L' | undefined = undefined;
          const oppBatter = getOpponentBatter(0);
          const myPitcher = players.find(p => p.id === selectedPitcherId);
          
          if (oppBatter) {
              if (oppBatter.bats === 'S') {
                  // Switch Hitter bats opposite to pitcher
                  if (myPitcher) {
                      vsHand = myPitcher.throws === 'R' ? 'L' : 'R';
                  } else {
                      vsHand = 'L'; // Default if my pitcher unknown (batting left vs unknown righty)
                  }
              } else {
                  vsHand = oppBatter.bats as 'R' | 'L';
              }
          }
          if (!vsHand) vsHand = 'R';

          const record: PitcherPlayRecord = { id: generateUUID(), gameId, date, opponent, playerId: selectedPitcherId, playerName: players.find(p=>p.id===selectedPitcherId)?.name||'Unknown', inning: gameState.inning, result: res, coordX: ballCoord?.x, coordY: ballCoord?.y, isOut: ['SO','GO','FO','SAC','SF','GIDP'].includes(res), runScored: runsToSave, earnedRun: liveER, vsHand: vsHand }; 
          savePitcherPlayRecord(record); 
          if (currentPlayerId && !currentPlayerId.startsWith('unknown')) { 
              const oppRecord: PlateAppearance = { 
                  id: generateUUID(), gameId, date, opponent: 'My Team', playerId: currentPlayerId, playerName: currentPlayerName, inning: gameState.inning, isTop: gameState.topBottom === 'Top', 
                  runner1: gameState.runner1, runner2: gameState.runner2, runner3: gameState.runner3, 
                  result: res, direction: selectedDirection || 0, rbi: runsToSave, isSteal: false, coordX: ballCoord?.x, coordY: ballCoord?.y,
                  vsHand: myPitcher?.throws || 'R' // Opponent stats vs Me
              }; 
              savePARecord(oppRecord); 
          } showMessage('success', `【守備】結果記録`); 
          if (!['XI', 'WP', 'BK'].includes(res)) setCurrentOppBatterIndex(prev => (prev + 1) % 9); 
      } if (nextState.outs >= 3) { setGameState(nextState); setTimeout(() => handleChangeSide(), 500); } else { setGameState(nextState); } setSelectedResult(null); setSelectedDirection(0); setLiveRbi(0); setLiveRunScored(0); setLiveER(0); setBallCoord(null); };
  const handleLiveSubmit = () => { if (!validateCommon()) return; if (!selectedResult) { showMessage('error', '結果を選択してください'); return; } const triggersReview = ['1B', '2B', '3B', 'HR', 'ROE', 'FC', 'SF', 'SAC', 'GIDP'].includes(selectedResult); if (triggersReview) { openReviewModal(selectedResult); } else { let nextOuts = gameState.outs; const isOut = ['SO', 'GO', 'FO', 'SAC', 'SF', 'GIDP'].includes(selectedResult); if (isOut) nextOuts++; const nextState = { ...gameState, outs: nextOuts }; if (['BB', 'IBB', 'HBP'].includes(selectedResult)) { let currentPlayerId = gameState.currentSide === 'Attack' ? getBatterInLineup(0)?.id : getOpponentBatter(0)?.id; if (currentPlayerId) { if (nextState.runner1 && nextState.runner2 && nextState.runner3) { /* ... */ } else if (nextState.runner1 && nextState.runner2) { nextState.runner3 = true; nextState.runner3Id = nextState.runner2Id; nextState.runner2 = true; nextState.runner2Id = nextState.runner1Id; } else if (nextState.runner1) { nextState.runner2 = true; nextState.runner2Id = nextState.runner1Id; } nextState.runner1 = true; nextState.runner1Id = currentPlayerId; } } commitPlay(selectedResult, nextState, 0); } };
  const handleFieldClick = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => { const svg = e.currentTarget; const rect = svg.getBoundingClientRect(); const x = ((e.clientX - rect.left) / rect.width) * 100; const y = ((e.clientY - rect.top) / rect.height) * 100; if (tab === 'live') { setBallCoord({ x, y }); if (gameState.currentSide === 'Attack') { if (x < 35) setSelectedDirection(7); else if (x > 65) setSelectedDirection(9); else setSelectedDirection(8); } } else if (tab === 'batch_pitcher') { const newSpray = { x, y, result: pitcherBatchSprayType }; setPStats(prev => ({ ...prev, allowed_spray: [...(prev.allowed_spray||[]), newSpray], h: (prev.h||0) + (['1B','2B','3B','HR'].includes(pitcherBatchSprayType) ? 1 : 0) })); } };
  const Counter = ({ label, val, setVal, colorClass="bg-slate-100", step=1 }: any) => ( <div className="flex flex-col items-center bg-white p-2 rounded border border-slate-200 shadow-sm min-w-[70px]"> <span className="text-[10px] text-slate-500 font-bold mb-1 whitespace-nowrap">{label}</span> <div className="flex items-center gap-1"> <button onClick={() => setVal(Math.max(0, (val||0) - step))} className={`w-6 h-6 rounded flex items-center justify-center ${colorClass}`}><Minus size={12}/></button> <input type="number" min="0" value={val||0} onChange={(e) => setVal(parseInt(e.target.value)||0)} onFocus={(e)=>e.target.select()} className="w-10 text-center font-bold outline-none bg-transparent text-sm" /> <button onClick={() => setVal((val||0) + step)} className={`w-6 h-6 rounded flex items-center justify-center ${colorClass}`}><Plus size={12}/></button> </div> </div> );
  const ResultButton = ({ res, label, color="bg-white hover:bg-slate-50" }: any) => ( <button onClick={() => setSelectedResult(res)} className={`py-3 rounded-lg font-bold text-sm border transition ${selectedResult === res ? 'bg-team-navy text-white' : color}`}>{label}</button> );
  const OppBatterStatsCard = ({ stats, name }: {stats: any, name: string}) => ( <div className="absolute -top-12 left-0 right-0 bg-black/80 text-white text-xs p-2 rounded flex justify-between items-center shadow-lg"> <span className="font-bold">{name}</span> <div className="flex gap-2 font-mono"><span>Avg: {stats.avg}</span><span>SB: {stats.sb}</span></div> </div> );
  const handleBatterBatchSubmit = () => { saveBatchRecord({id: generateUUID(), date, opponent, playerId: selectedPlayerId, playerName: players.find(p=>p.id===selectedPlayerId)?.name||'Unk', ...batchStats}); showMessage('success','保存しました'); setBatchStats({ab:0,h:0,double:0,triple:0,hr:0,bb:0,ibb:0,hbp:0,k:0,sf:0,sac:0,r:0,rbi:0,sb:0,cs:0,gidp:0}); };
  const handlePitcherBatchSubmit = () => { savePitcherRecord({ id: generateUUID(), date, opponent, playerId: selectedPlayerId, playerName: players.find(p=>p.id===selectedPlayerId)?.name||'Unk', outs: computedOuts, isStarter: pStats.isStarter??true, result: pStats.result??null, h: pStats.h||0, hr: pStats.hr||0, r: pStats.r||0, er: pStats.er||0, bb: pStats.bb||0, ibb: pStats.ibb||0, hbp: pStats.hbp||0, k: pStats.k||0, wild_pitch: pStats.wild_pitch||0, p_count: pStats.p_count||0, ab:0, h2: pStats.h2||0, h3: pStats.h3||0, sac: pStats.sac||0, sf: pStats.sf||0, go: pStats.go||0, fo: pStats.fo||0, run_support: pStats.run_support||0, support_innings: pStats.support_innings||0, stop_win_streak: pStats.stop_win_streak||false, stop_loss_streak: pStats.stop_loss_streak||false, allowed_spray: pStats.allowed_spray }); showMessage('success','保存しました'); setPStats({isStarter:true,ip:0,outs_frac:0,h:0,hr:0,bb:0,ibb:0,hbp:0,k:0,wild_pitch:0,r:0,er:0,p_count:0,result:null,ab:0,h2:0,h3:0,sac:0,sf:0,go:0,fo:0,run_support:0,support_innings:0,stop_win_streak:false,stop_loss_streak:false,allowed_spray:[]}); };
  const handlePitcherBatchUndoSpray = () => { setPStats(p => ({...p, allowed_spray: (p.allowed_spray||[]).slice(0,-1) })); };
  const PitcherSprayButton = ({ res, label, type='hit' }: {res: any, label: string, type?: 'hit'|'out'}) => { return <button onClick={()=>setPitcherBatchSprayType(res)} className={`flex-1 py-1 rounded font-bold text-xs border transition ${pitcherBatchSprayType===res ? (type==='hit'?'bg-team-red text-white':'bg-blue-600 text-white') : 'bg-white text-slate-500'}`}>{label}</button> };
  const getGameLogText = () => { if (!date || !opponent) return "試合情報がありません"; const gameId = `${date}-${opponent}`; const paRecs = getPARecords().filter(r => (r.gameId === gameId || (r.date === date && r.opponent === opponent)) && r.opponent !== 'My Team'); const pRecs = getPitcherPlayRecords().filter(r => r.gameId === gameId || (r.date === date && r.opponent === opponent)); const maxInning = Math.max( ...paRecs.map(r => r.inning), ...pRecs.map(r => r.inning), 0 ); let log = `=== 試合経過速報 ===\n日付: ${date}\n相手: ${opponent}\n\n`; for (let i = 1; i <= maxInning; i++) { log += `--- ${i}回 ---\n`; const innPa = paRecs.filter(r => r.inning === i); const innP = pRecs.filter(r => r.inning === i); const isAttackTop = innPa.length > 0 ? innPa[0].isTop : null; if (innPa.length > 0) { log += `[攻撃] (${isAttackTop ? '表' : '裏'})\n`; innPa.forEach(r => { log += `  ${r.playerName}: ${r.result} ${r.rbi > 0 ? `(${r.rbi}打点)` : ''} ${r.isSteal ? '(盗塁)' : ''}\n`; }); } if (innP.length > 0) { log += `[守備] (${isAttackTop === true ? '裏' : isAttackTop === false ? '表' : '?'})\n`; innP.forEach(r => { log += `  投手 ${r.playerName}: ${r.result} ${r.runScored > 0 ? `(失点${r.runScored})` : ''}\n`; }); } log += "\n"; } const myScore = paRecs.reduce((sum, r) => sum + r.rbi, 0); const oppScore = pRecs.reduce((sum, r) => sum + (r.runScored || 0), 0); log += `[スコア] 自 ${myScore} - ${oppScore} 相手\n`; return log; };
  // ... generateSNSPost and others unchanged ...
  const generateSNSPost = () => {
      const gameId = `${date}-${opponent}`;
      const paRecs = getPARecords().filter(r => (r.gameId === gameId || (r.date === date && r.opponent === opponent)) && r.opponent !== 'My Team');
      const pRecs = getPitcherPlayRecords().filter(r => r.gameId === gameId || (r.date === date && r.opponent === opponent));
      const myScore = paRecs.reduce((sum, r) => sum + r.rbi, 0);
      const oppScore = pRecs.reduce((sum, r) => sum + (r.runScored || 0), 0);
      
      const win = myScore > oppScore;
      const lose = myScore < oppScore;
      const resultStr = win ? "Win!" : lose ? "Lose..." : "Draw";

      const batterScores = new Map<string, {name: string, score: number, h:number, rbi:number, hr:number}>();
      paRecs.forEach(r => {
          if (!batterScores.has(r.playerId)) batterScores.set(r.playerId, {name: r.playerName, score:0, h:0, rbi:0, hr:0});
          const b = batterScores.get(r.playerId)!;
          if (['1B','2B','3B','HR'].includes(r.result)) b.h++;
          if (r.result === 'HR') b.hr++;
          b.rbi += r.rbi;
          let pts = 0; if(r.result==='1B') pts+=1; if(r.result==='2B') pts+=2; if(r.result==='3B') pts+=3; if(r.result==='HR') pts+=4; pts += r.rbi * 1.5; b.score += pts;
      });
      const topBatter = Array.from(batterScores.values()).sort((a,b) => b.score - a.score)[0];

      const pitcherScores = new Map<string, {name:string, outs:number, r:number, k:number}>();
      pRecs.forEach(r => {
          if (!pitcherScores.has(r.playerId)) pitcherScores.set(r.playerId, {name: r.playerName, outs:0, r:0, k:0});
          const p = pitcherScores.get(r.playerId)!;
          if (r.isOut) p.outs++;
          if (['SO'].includes(r.result)) p.k++;
          p.r += (r.runScored || 0);
      });
      const topPitcher = Array.from(pitcherScores.values()).sort((a,b) => { if (a.r !== b.r) return a.r - b.r; return b.outs - a.outs; })[0];

      let heroStr = "";
      if (win) {
          if (topBatter && topBatter.score >= 2) { heroStr += `${topBatter.name} (${topBatter.h}安打 ${topBatter.rbi}打点${topBatter.hr>0 ? ` ${topBatter.hr}HR` : ''})\n`; }
          if (topPitcher) { const ip = Math.floor(topPitcher.outs/3) + (topPitcher.outs%3 === 1 ? ".1" : topPitcher.outs%3 === 2 ? ".2" : ""); heroStr += `${topPitcher.name} (${ip}回 ${topPitcher.r}失点 ${topPitcher.k}奪三振)\n`; }
      } else { if (topBatter && topBatter.score >= 2) { heroStr += `${topBatter.name} (${topBatter.h}安打 ${topBatter.rbi}打点)\n`; } else { heroStr += "なし\n"; } }
      return `【試合結果】\n${date} vs ${opponent}\n自チーム ${myScore} - ${oppScore} 相手\n${resultStr}\n\n【本日のヒーロー】\n${heroStr}\n#IndieBall #草野球 #試合結果`;
  };
  const copyToClipboard = (text?: string) => { const txt = text || getGameLogText(); if (navigator && navigator.clipboard) { navigator.clipboard.writeText(txt).then(() => { showMessage('success', 'コピーしました'); }).catch(() => { showMessage('error', 'コピーに失敗しました'); }); } else { showMessage('error', 'このブラウザではコピー機能が使用できません'); } };
  const downloadLogText = () => { const text = getGameLogText(); const blob = new Blob([text], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `gamelog_${date}_${opponent}.txt`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
  const downloadLogCSV = () => { let csv = '\uFEFFInning,Side,Player,Result,Detail\n'; const gameId = `${date}-${opponent}`; const paRecs = getPARecords().filter(r => (r.gameId === gameId || (r.date === date && r.opponent === opponent)) && r.opponent !== 'My Team'); const pRecs = getPitcherPlayRecords().filter(r => r.gameId === gameId || (r.date === date && r.opponent === opponent)); const maxInning = Math.max( ...paRecs.map(r => r.inning), ...pRecs.map(r => r.inning), 0 ); for (let i = 1; i <= maxInning; i++) { const innPa = paRecs.filter(r => r.inning === i); const innP = pRecs.filter(r => r.inning === i); innPa.forEach(r => { csv += `${i},${r.isTop?'Top':'Bot'},"${r.playerName}",${r.result},${r.rbi>0?`RBI${r.rbi}`:''}${r.isSteal?'SB':''}\n`; }); innP.forEach(r => { csv += `${i},Defense,"P ${r.playerName}",${r.result},${r.runScored>0?`Runs${r.runScored}`:''}\n`; }); } const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `gamelog_${date}_${opponent}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Top Controls ... */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div className="flex gap-2 w-full md:w-auto">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="p-2 border rounded text-sm flex-1" />
                <input type="text" list="opponent-list" placeholder="対戦相手" value={opponent} onChange={(e) => setOpponent(e.target.value)} className="p-2 border rounded text-sm flex-1" />
                <datalist id="opponent-list">{opponents.map(op => <option key={op.id} value={op.name} />)}</datalist>
             </div>
             <div className="flex items-center gap-2 w-full md:w-auto">
                 {gamePhase === 'playing' && tab === 'live' && (
                     <>
                         <button onClick={() => setLogModalOpen(true)} className="p-2 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center gap-1 hover:bg-indigo-200" title="試合速報ログ"><FileText size={18}/> 速報</button>
                         <button onClick={() => setResetModalOpen(true)} className="p-2 rounded-lg bg-red-100 text-red-700 font-bold flex items-center gap-1 hover:bg-red-200" title="試合終了・リセット"><LogOut size={18}/> 終了</button>
                     </>
                 )}
                 <button onClick={() => setHelpModalOpen(true)} className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200" title="入力ヘルプ"><HelpCircle size={20}/></button>
                 <div className="flex bg-slate-100 p-1 rounded-lg flex-1 md:flex-none">
                    <button onClick={() => setTab('live')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition ${tab==='live' ? 'bg-white shadow text-team-navy' : 'text-slate-400'}`}><Zap size={14} className="inline mr-1"/>試合モード</button>
                    <button onClick={() => setTab('batch_batter')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition ${tab==='batch_batter' ? 'bg-white shadow text-blue-700' : 'text-slate-400'}`}><ClipboardList size={14} className="inline mr-1"/>野手一括</button>
                    <button onClick={() => setTab('batch_pitcher')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition ${tab==='batch_pitcher' ? 'bg-white shadow text-red-700' : 'text-slate-400'}`}><ClipboardList size={14} className="inline mr-1"/>投手一括</button>
                 </div>
             </div>
          </div>
      </div>

      {tab === 'live' && gamePhase === 'setup' && (
          <div className="animate-in fade-in space-y-4">
              <div className="bg-white p-6 rounded-xl border shadow-lg max-w-2xl mx-auto">
                  <h3 className="text-xl font-bold text-team-navy mb-4 flex items-center gap-2"><Users/> スタメン・打順登録</h3>
                  <p className="text-sm text-slate-500 mb-6">試合開始前に本日のスターティングオーダー（1番〜9番）を設定してください。<br/>未設定の選手は自動的に「ベンチ」扱いとなります。</p>
                  
                  {/* Setup Tabs */}
                  <div className="flex border-b mb-6">
                      <button onClick={()=>setSetupTab('my')} className={`flex-1 py-2 font-bold text-sm border-b-2 transition ${setupTab==='my' ? 'border-team-navy text-team-navy' : 'border-transparent text-slate-400'}`}>自チーム (攻撃)</button>
                      <button onClick={()=>setSetupTab('opp')} className={`flex-1 py-2 font-bold text-sm border-b-2 transition ${setupTab==='opp' ? 'border-team-navy text-team-navy' : 'border-transparent text-slate-400'}`}>相手チーム (守備)</button>
                  </div>

                  {setupTab === 'my' ? (
                      <div className="space-y-3 mb-8">
                          {myLineup.map((pid, idx) => (
                              <div key={idx} className="flex items-center gap-3">
                                  <span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full font-bold text-slate-600 shadow-sm">{idx + 1}</span>
                                  <select className="flex-1 p-3 border rounded-lg font-bold bg-slate-50 focus:bg-white transition disabled:bg-slate-100 disabled:text-slate-400" value={pid} onChange={(e) => handleLineupChange(idx, e.target.value)}>
                                      <option value="">-- 選手を選択 --</option>
                                      {myTeamPlayers.filter(p => p.type !== 'pitcher').map(p => (
                                          <option key={p.id} value={p.id} disabled={myLineup.includes(p.id) && p.id !== pid}>{p.name} (#{p.number}) {p.position} {myLineup.includes(p.id) && p.id !== pid ? '(選択済)' : ''}</option>
                                      ))}
                                  </select>
                                  {/* Position Input */}
                                  <input type="text" placeholder="守備" className="w-20 p-3 border rounded-lg font-bold text-center" value={myLineupPositions[idx] || ''} onChange={(e) => handleLineupPositionChange(idx, e.target.value)} />
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="space-y-3 mb-8">
                          {!currentOpponentId ? (
                              <div className="text-center p-4 text-red-500 bg-red-50 rounded">先に対戦相手を選択・登録してください</div>
                          ) : (
                              <>
                                  {opponentLineupIds.map((pid, idx) => (
                                      <div key={idx} className="flex items-center gap-3">
                                          <span className="w-8 h-8 flex items-center justify-center bg-red-50 rounded-full font-bold text-red-600 shadow-sm">{idx + 1}</span>
                                          <select className="flex-1 p-3 border rounded-lg font-bold bg-slate-50 focus:bg-white transition disabled:bg-slate-100 disabled:text-slate-400" value={pid} onChange={(e) => handleOpponentLineupChange(idx, e.target.value)}>
                                              <option value="">-- 相手選手を選択 --</option>
                                              {opponentPlayers.map(p => (
                                                  <option key={p.id} value={p.id} disabled={opponentLineupIds.includes(p.id) && p.id !== pid}>{p.name} #{p.number} {opponentLineupIds.includes(p.id) && p.id !== pid ? '(選択済)' : ''}</option>
                                              ))}
                                          </select>
                                          {/* Position Input */}
                                          <input type="text" placeholder="守備" className="w-20 p-3 border rounded-lg font-bold text-center" value={opponentLineupPositions[idx] || ''} onChange={(e) => handleOpponentLineupPositionChange(idx, e.target.value)} />
                                      </div>
                                  ))}
                                  
                                  {/* Quick Add Player in Setup */}
                                  <div className="border-t pt-4 mt-4">
                                      <h4 className="text-xs font-bold text-slate-500 mb-2">相手選手を登録（クイック）</h4>
                                      <div className="flex gap-2">
                                          <input type="text" placeholder="選手名" className="flex-1 p-2 border rounded text-sm" value={newOppPlayerName} onChange={e=>setNewOppPlayerName(e.target.value)} />
                                          <input type="text" placeholder="#" className="w-16 p-2 border rounded text-sm" value={newOppPlayerNumber} onChange={e=>setNewOppPlayerNumber(e.target.value)} />
                                          <button onClick={handleQuickAddOpponentPlayer} className="bg-blue-600 text-white px-3 rounded font-bold hover:bg-blue-700"><Plus size={16}/></button>
                                      </div>
                                  </div>
                              </>
                          )}
                      </div>
                  )}

                  <button onClick={handleStartGame} className="w-full py-4 bg-team-navy text-white rounded-xl font-bold text-lg shadow-lg hover:bg-slate-800 transition flex items-center justify-center gap-2"><Play fill="white" size={20}/> 試合開始 (プレイボール)</button>
              </div>
          </div>
      )}

      {tab === 'live' && gamePhase === 'playing' && (
         <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
             {/* Scoreboard Header */}
             <div className="bg-slate-800 text-white p-4 rounded-xl shadow-lg relative overflow-hidden">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center opacity-20 pointer-events-none"><div className="text-[80px] font-bold leading-none tracking-tighter flex gap-8"><span>{currentScore.my}</span><span>-</span><span>{currentScore.opp}</span></div></div>
                 <div className="flex justify-between items-center mb-4 relative z-10">
                     <div className="flex items-center gap-2">
                         <button onClick={()=>setGameState(p=>({...p, inning: Math.max(1, p.inning-1)}))} className="p-1 hover:bg-slate-700 rounded"><ChevronDown/></button>
                         <span className="text-2xl font-bold font-mono">{gameState.inning}</span>
                         <div className="flex flex-col text-[10px] font-bold leading-tight text-slate-400"><span className={gameState.topBottom==='Top'?'text-white':''}>表</span><span className={gameState.topBottom==='Bot'?'text-white':''}>裏</span></div>
                         <button onClick={()=>setGameState(p=>({...p, inning: p.inning+1}))} className="p-1 hover:bg-slate-700 rounded"><ChevronUp/></button>
                         <button onClick={()=>setGameState(p=>({...p, topBottom: p.topBottom==='Top'?'Bot':'Top'}))} className="ml-2 px-2 py-1 bg-slate-700 rounded text-xs">表裏切替</button>
                     </div>
                     <div className="flex items-center gap-4">
                         <div className="flex gap-1">{[1,2].map(o => (<div key={o} className={`w-4 h-4 rounded-full border-2 border-red-500 ${gameState.outs >= o ? 'bg-red-500' : 'bg-slate-800'}`} />))}</div>
                         <div className="flex items-center gap-2"><span className="font-bold text-xl">OUT</span><div className="flex gap-1"><button onClick={()=>setGameState(p=>({...p, outs: Math.max(0, p.outs-1)}))} className="px-2 bg-slate-700 rounded">-</button><button onClick={()=>setGameState(p=>({...p, outs: Math.min(2, p.outs+1)}))} className="px-2 bg-slate-700 rounded">+</button><button onClick={handleChangeSide} className="px-2 bg-slate-600 rounded text-xs ml-2">チェンジ</button></div></div>
                     </div>
                 </div>
                 {/* ... (Runners, Score, etc. Unchanged) ... */}
                 <div className="flex justify-between items-end relative z-10">
                     <div className="relative w-24 h-24 opacity-90 scale-75 origin-bottom-left">
                          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 rotate-45 border-2 transition-all ${gameState.runner2 ? 'bg-yellow-400 border-yellow-400' : 'bg-slate-700 border-slate-600'}`} />
                          <div className={`absolute top-8 left-0 w-8 h-8 rotate-45 border-2 transition-all ${gameState.runner3 ? 'bg-yellow-400 border-yellow-400' : 'bg-slate-700 border-slate-600'}`} />
                          <div className={`absolute top-8 right-0 w-8 h-8 rotate-45 border-2 transition-all ${gameState.runner1 ? 'bg-yellow-400 border-yellow-400' : 'bg-slate-700 border-slate-600'}`} />
                     </div>
                     <div className="flex flex-col items-end gap-2">
                         <div className="flex items-center gap-3 font-mono text-xl font-bold bg-black/30 px-3 py-1 rounded-lg border border-white/10 mb-2">
                             <span className={gameState.currentSide==='Attack' ? 'text-yellow-400' : 'text-white'}>{currentScore.my}</span><span className="text-slate-400">-</span><span className={gameState.currentSide==='Defense' ? 'text-yellow-400' : 'text-white'}>{currentScore.opp}</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <div className="flex flex-col gap-1">
                                 <button onClick={()=>setGameState(p=>({...p, currentSide: 'Attack'}))} className={`px-4 py-1 rounded text-sm font-bold border transition ${gameState.currentSide==='Attack' ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-600 text-slate-400'}`}>攻撃 (自)</button>
                                 <button onClick={()=>setGameState(p=>({...p, currentSide: 'Defense'}))} className={`px-4 py-1 rounded text-sm font-bold border transition ${gameState.currentSide==='Defense' ? 'bg-red-600 border-red-600 text-white' : 'border-slate-600 text-slate-400'}`}>守備 (自)</button>
                             </div>
                         </div>
                     </div>
                 </div>
                 
                 {/* In-Game Menu for Substitutions */}
                 <div className="flex gap-2 justify-between bg-black/20 p-2 rounded-lg">
                     <button onClick={() => setMyLineupModalOpen(true)} className="flex-1 py-1 text-xs border border-slate-500 rounded text-slate-300 font-bold hover:bg-slate-700 flex items-center justify-center gap-1"><RefreshCcw size={12}/> 自チーム交代・守備</button>
                     <button onClick={() => setOppLineupModalOpen(true)} className="flex-1 py-1 text-xs border border-slate-500 rounded text-slate-300 font-bold hover:bg-slate-700 flex items-center justify-center gap-1"><ArrowLeftRight size={12}/> 相手交代・守備</button>
                 </div>
             </div>

             {/* Player Select Area */}
             {gameState.currentSide === 'Attack' ? (
                 <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3 relative">
                     <div className="flex justify-between text-xs text-slate-400 font-bold px-1"><span>打順: {currentBatterIndex + 1}番</span><span>Next: {getBatterInLineup(1)?.name || '未定'}</span></div>
                     <div className="flex gap-2 items-stretch">
                         <button onClick={() => setCurrentBatterIndex(prev => (prev - 1 + 9) % 9)} className="px-3 bg-slate-100 rounded-lg text-slate-400 hover:bg-slate-200"><Undo2 size={16}/></button>
                         <div className="flex-1 bg-blue-50 border-2 border-blue-200 rounded-xl p-3 relative flex flex-col justify-center items-center">
                             {getBatterInLineup(0) && getPlayerMiniStats(getBatterInLineup(0)!.id) && <OppBatterStatsCard stats={getPlayerMiniStats(getBatterInLineup(0)!.id)} name={getBatterInLineup(0)!.name} />}
                             <span className="text-xs text-blue-500 font-bold mb-1">現在の打者</span>
                             <div className="text-xl font-bold text-team-navy">{getBatterInLineup(0)?.name || '打者未設定'}</div>
                             <div className="text-sm text-slate-500">#{getBatterInLineup(0)?.number} {myLineupPositions[currentBatterIndex]}</div>
                         </div>
                         <button onClick={() => setCurrentBatterIndex(prev => (prev + 1) % 9)} className="px-3 bg-slate-100 rounded-lg text-slate-400 hover:bg-slate-200"><RotateCw size={16}/></button>
                     </div>
                     <button onClick={() => setPhModalOpen(true)} className="w-full py-2 border-2 border-slate-200 text-slate-500 font-bold rounded-lg hover:bg-slate-50 text-xs flex items-center justify-center gap-2 mb-2"><Users size={14}/> 選手交代 / 代打 (PH)</button>
                     
                     {/* Opponent Pitcher Selector */}
                     <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                         <label className="text-xs font-bold text-red-500 block mb-1">現在登板中の相手投手</label>
                         <select value={currentOppPitcherId} onChange={(e) => setCurrentOppPitcherId(e.target.value)} className="w-full p-2 text-sm border border-red-200 rounded text-slate-700 bg-white">
                             <option value="">-- 未選択 (右投扱い) --</option>
                             {opponentPlayers.map(p => (
                                 <option key={p.id} value={p.id}>{p.name} (#{p.number}) {p.throws}投</option>
                             ))}
                         </select>
                     </div>
                 </div>
             ) : (
                 <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
                      <label className="text-xs font-bold text-red-500 block mb-1">登板中の投手 (自チーム)</label>
                      <select value={selectedPitcherId} onChange={(e) => setSelectedPitcherId(e.target.value)} className="w-full p-3 border-2 border-slate-200 rounded-lg font-bold text-lg bg-slate-50 mb-2">
                        <option value="">-- 投手を選択 --</option>
                        {myTeamPlayers.filter(p => p.type !== 'batter').map(p => (
                            <option key={p.id} value={p.id}>{p.name} (#{p.number})</option>
                        ))}
                      </select>

                      <div className="bg-red-50 p-2 rounded-lg border border-red-100 flex items-center justify-between relative">
                          {getOpponentBatter(0) && getPlayerMiniStats(getOpponentBatter(0).id) && <OppBatterStatsCard stats={getPlayerMiniStats(getOpponentBatter(0).id)} name={getOpponentBatter(0).name} />}
                          <div className="flex items-center gap-2">
                              <span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-1 rounded">相手打者</span>
                              <div className="flex flex-col">
                                  <span className="font-bold text-sm text-slate-800">{currentOppBatterIndex + 1}番 {getOpponentBatter(0).name}</span>
                                  <span className="text-xs text-slate-500">#{getOpponentBatter(0).number} {opponentLineupPositions[currentOppBatterIndex]} {getOpponentBatter(0).bats}打</span>
                              </div>
                          </div>
                          <div className="flex gap-1">
                              <button onClick={() => setCurrentOppBatterIndex(prev => (prev - 1 + 9) % 9)} className="p-1 bg-white rounded border hover:bg-slate-50"><Undo2 size={12}/></button>
                              <button onClick={() => setCurrentOppBatterIndex(prev => (prev + 1) % 9)} className="p-1 bg-white rounded border hover:bg-slate-50"><RotateCw size={12}/></button>
                          </div>
                      </div>
                      
                      {/* Opponent PH Button */}
                      <button onClick={() => setOppPhModalOpen(true)} className="w-full py-1 text-xs border border-slate-300 rounded text-slate-500 font-bold hover:bg-slate-50 flex items-center justify-center gap-1"><Users size={12}/> 相手代打 (PH)</button>
                 </div>
             )}

             {/* Field & Input Area (Unchanged) */}
             <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col items-center">
                 <div className="relative w-full max-w-[350px] aspect-square bg-green-700 rounded-lg shadow-inner overflow-hidden cursor-crosshair mb-4">
                      <svg width="100%" height="100%" viewBox="0 0 100 100" onClick={handleFieldClick}>
                          <rect width="100" height="100" fill="#15803d" />
                          <line x1="50" y1="85" x2="0" y2="35" stroke="white" strokeWidth="0.5" />
                          <line x1="50" y1="85" x2="100" y2="35" stroke="white" strokeWidth="0.5" />
                          <path d="M 50 85 L 75 60 L 50 35 L 25 60 Z" fill="#a36936" opacity="0.8" />
                          <path d="M 0 35 Q 50 -10 100 35" stroke="white" strokeWidth="0.5" fill="none" />
                          {ballCoord && <circle cx={ballCoord.x} cy={ballCoord.y} r="2" fill="yellow" stroke="black" strokeWidth="1" />}
                      </svg>
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded pointer-events-none">{gameState.currentSide==='Attack' ? '打球位置をタップ' : '被安打位置をタップ'}</div>
                 </div>

                 <div className="w-full max-w-[350px] mb-6 space-y-2">
                    <div className="flex justify-center">
                        <button onClick={() => handleBaseClick('runner2')} className={`w-full max-w-[200px] py-3 rounded-lg font-bold border-2 transition shadow-sm relative ${gameState.runner2 ? 'bg-yellow-400 border-yellow-500 text-black shadow-yellow-200' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                            <span className="text-xs absolute top-1 left-2">2B</span>
                            <span className="text-sm truncate px-4 block">{gameState.runner2 ? getRunnerName(gameState.runner2Id) : '走者なし'}</span>
                            {gameState.runner2 && <span className="absolute top-1 right-2"><Activity size={14}/></span>}
                        </button>
                    </div>
                    <div className="flex gap-2 w-full">
                        <button onClick={() => handleBaseClick('runner3')} className={`flex-1 py-4 rounded-lg font-bold border-2 transition shadow-sm relative ${gameState.runner3 ? 'bg-yellow-400 border-yellow-500 text-black shadow-yellow-200' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                            <span className="text-xs absolute top-1 left-2">3B</span>
                            <div className="flex items-center justify-center h-full"><span className="text-sm truncate max-w-[100px]">{gameState.runner3 ? getRunnerName(gameState.runner3Id) : '走者なし'}</span></div>
                            {gameState.runner3 && <span className="absolute top-1 right-2"><Activity size={14}/></span>}
                        </button>
                        <button onClick={() => handleBaseClick('runner1')} className={`flex-1 py-4 rounded-lg font-bold border-2 transition shadow-sm relative ${gameState.runner1 ? 'bg-yellow-400 border-yellow-500 text-black shadow-yellow-200' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                            <span className="text-xs absolute top-1 left-2">1B</span>
                            <div className="flex items-center justify-center h-full"><span className="text-sm truncate max-w-[100px]">{gameState.runner1 ? getRunnerName(gameState.runner1Id) : '走者なし'}</span></div>
                            {gameState.runner1 && <span className="absolute top-1 right-2"><Activity size={14}/></span>}
                        </button>
                    </div>
                 </div>

                 {gameState.currentSide === 'Attack' ? (
                     <div className="flex items-center gap-4 mb-4 bg-blue-50 p-2 rounded-lg">
                         <span className="text-sm font-bold text-blue-800">打点</span><button onClick={()=>setLiveRbi(Math.max(0,liveRbi-1))} className="w-8 h-8 bg-white border rounded shadow-sm">-</button><span className="font-bold text-xl w-6 text-center">{liveRbi}</span><button onClick={()=>setLiveRbi(liveRbi+1)} className="w-8 h-8 bg-white border rounded shadow-sm">+</button>
                     </div>
                 ) : (
                     <div className="flex gap-4 mb-4">
                         <div className="flex items-center gap-2 bg-red-50 p-2 rounded-lg"><span className="text-sm font-bold text-red-800">失点</span><button onClick={()=>setLiveRunScored(Math.max(0,liveRunScored-1))} className="w-6 h-6 bg-white border rounded text-xs">-</button><span className="font-bold w-4 text-center">{liveRunScored}</span><button onClick={()=>setLiveRunScored(liveRunScored+1)} className="w-6 h-6 bg-white border rounded text-xs">+</button></div>
                         <div className="flex items-center gap-2 bg-red-50 p-2 rounded-lg"><span className="text-sm font-bold text-red-800">自責</span><button onClick={()=>setLiveER(Math.max(0,liveER-1))} className="w-6 h-6 bg-white border rounded text-xs">-</button><span className="font-bold w-4 text-center">{liveER}</span><button onClick={()=>setLiveER(liveER+1)} className="w-6 h-6 bg-white border rounded text-xs">+</button></div>
                     </div>
                 )}

                 <div className="grid grid-cols-4 md:grid-cols-5 gap-2 w-full mb-4">
                    <ResultButton res="1B" label="単打" color="bg-red-50 text-red-700" /><ResultButton res="2B" label="二塁打" color="bg-red-50 text-red-700" /><ResultButton res="3B" label="三塁打" color="bg-red-50 text-red-700" /><ResultButton res="HR" label="本塁打" color="bg-red-100 text-red-800" /><ResultButton res="BB" label="四球" color="bg-blue-50 text-blue-700" /><ResultButton res="HBP" label="死球" color="bg-blue-50 text-blue-700" /><ResultButton res="IBB" label="敬遠" color="bg-blue-50 text-blue-700" /><ResultButton res="SO" label="三振" /><ResultButton res="GO" label="ゴロ" /><ResultButton res="FO" label="フライ" /><ResultButton res="SAC" label="犠打" /><ResultButton res="SF" label="犠飛" /><ResultButton res="ROE" label="失策" /><ResultButton res="FC" label="野選" /><ResultButton res="GIDP" label="併殺 (DP)" color="bg-slate-200 text-slate-800" />
                    {gameState.currentSide === 'Defense' && (<><ResultButton res="WP" label="暴投" color="bg-orange-50 text-orange-800" /><ResultButton res="BK" label="ボーク" color="bg-orange-50 text-orange-800" /></>)}
                 </div>
                 <button onClick={handleLiveSubmit} className={`w-full py-4 rounded-xl font-bold text-lg shadow text-white transition ${gameState.currentSide==='Attack'?'bg-blue-600 hover:bg-blue-700':'bg-red-600 hover:bg-red-700'}`}>{gameState.currentSide==='Attack' ? '打席結果を記録' : '投球結果を記録'}</button>
             </div>
         </div>
      )}

      {/* NEW: Batch Batter Form (Updated) */}
      {tab === 'batch_batter' && (
        <div className="animate-in fade-in space-y-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm">
                 <label className="text-sm font-bold text-slate-500 block mb-2">対象選手 (自チーム)</label>
                 <select 
                    value={selectedPlayerId} 
                    onChange={(e) => setSelectedPlayerId(e.target.value)} 
                    className="w-full p-3 border-2 border-blue-100 rounded-lg font-bold bg-blue-50 focus:bg-white transition"
                 >
                     <option value="">-- 選手を選択 --</option>
                     {myTeamPlayers.filter(p => p.type !== 'pitcher').map(p => (
                         <option key={p.id} value={p.id}>{p.name} (#{p.number}) {p.position}</option>
                     ))}
                 </select>
            </div>
            
            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center gap-2"><ClipboardList/> 野手成績一括入力</h3>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                    <Counter label="打数" val={batchStats.ab} setVal={(v:number)=>setBatchStats(p=>({...p, ab:v}))} />
                    <Counter label="安打" val={batchStats.h} setVal={(v:number)=>setBatchStats(p=>({...p, h:v}))} />
                    <Counter label="二塁打" val={batchStats.double} setVal={(v:number)=>setBatchStats(p=>({...p, double:v}))} />
                    <Counter label="三塁打" val={batchStats.triple} setVal={(v:number)=>setBatchStats(p=>({...p, triple:v}))} />
                    <Counter label="本塁打" val={batchStats.hr} setVal={(v:number)=>setBatchStats(p=>({...p, hr:v}))} colorClass="bg-red-50 text-red-600" />
                    <Counter label="打点" val={batchStats.rbi} setVal={(v:number)=>setBatchStats(p=>({...p, rbi:v}))} colorClass="bg-blue-50 text-blue-600" />
                    
                    <Counter label="得点" val={batchStats.r} setVal={(v:number)=>setBatchStats(p=>({...p, r:v}))} />
                    <Counter label="三振" val={batchStats.k} setVal={(v:number)=>setBatchStats(p=>({...p, k:v}))} />
                    <Counter label="四球 (合計)" val={batchStats.bb} setVal={(v:number)=>setBatchStats(p=>({...p, bb:v}))} />
                    <Counter label="敬遠 (内数)" val={batchStats.ibb} setVal={(v:number)=>setBatchStats(p=>({...p, ibb:v}))} colorClass="bg-blue-50 text-blue-600"/>
                    <Counter label="死球" val={batchStats.hbp} setVal={(v:number)=>setBatchStats(p=>({...p, hbp:v}))} />
                    <Counter label="犠飛" val={batchStats.sf} setVal={(v:number)=>setBatchStats(p=>({...p, sf:v}))} />
                    <Counter label="犠打" val={batchStats.sac} setVal={(v:number)=>setBatchStats(p=>({...p, sac:v}))} />

                    <Counter label="盗塁" val={batchStats.sb} setVal={(v:number)=>setBatchStats(p=>({...p, sb:v}))} />
                    <Counter label="盗塁死" val={batchStats.cs} setVal={(v:number)=>setBatchStats(p=>({...p, cs:v}))} />
                    <Counter label="併殺" val={batchStats.gidp} setVal={(v:number)=>setBatchStats(p=>({...p, gidp:v}))} />
                </div>
                
                <p className="text-xs text-slate-400 mb-4">※ 「四球」には敬遠を含めた総数を入力してください。「敬遠」欄はその内訳として入力します。</p>

                <button onClick={handleBatterBatchSubmit} disabled={!selectedPlayerId} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow hover:bg-blue-700 disabled:bg-slate-300 transition">保存する</button>
            </div>
        </div>
      )}

      {/* NEW: Batch Pitcher Form (Unchanged) */}
      {tab === 'batch_pitcher' && (
        <div className="animate-in fade-in space-y-4">
             <div className="bg-white p-4 rounded-xl border shadow-sm">
                 <label className="text-sm font-bold text-slate-500 block mb-2">対象投手 (自チーム)</label>
                 <select 
                    value={selectedPlayerId} 
                    onChange={(e) => setSelectedPlayerId(e.target.value)} 
                    className="w-full p-3 border-2 border-red-100 rounded-lg font-bold bg-red-50 focus:bg-white transition"
                 >
                     <option value="">-- 投手を選択 --</option>
                     {myTeamPlayers.filter(p => p.type !== 'batter').map(p => (
                         <option key={p.id} value={p.id}>{p.name} (#{p.number})</option>
                     ))}
                 </select>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center gap-2"><ClipboardList/> 投手成績一括入力</h3>
                
                {/* Result Flags */}
                <div className="flex gap-2 mb-6 bg-slate-50 p-3 rounded-lg overflow-x-auto">
                    <label className="flex items-center gap-2 bg-white px-3 py-2 rounded border cursor-pointer min-w-max">
                        <input type="checkbox" checked={pStats.isStarter} onChange={e=>setPStats(p=>({...p, isStarter: e.target.checked}))} className="w-4 h-4" />
                        <span className="text-sm font-bold">先発登板</span>
                    </label>
                    <select value={pStats.result||''} onChange={e=>setPStats(p=>({...p, result: e.target.value as any || null}))} className="bg-white px-3 py-2 rounded border text-sm font-bold">
                        <option value="">勝敗なし</option>
                        <option value="W">勝利投手</option>
                        <option value="L">敗戦投手</option>
                        <option value="SV">セーブ</option>
                        <option value="HLD">ホールド</option>
                    </select>
                </div>

                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                    <div className="col-span-2 md:col-span-2 bg-slate-50 p-2 rounded border flex flex-col items-center justify-center">
                        <span className="text-[10px] text-slate-500 font-bold mb-1">投球回 (イニング)</span>
                        <div className="flex items-end gap-1">
                            <Counter label="" val={pStats.ip} setVal={(v:number)=>setPStats(p=>({...p, ip:v}))} step={1} />
                            <span className="font-bold text-xl mb-2">.</span>
                            <div className="flex flex-col items-center">
                                <div className="flex gap-1">
                                    <button onClick={()=>setPStats(p=>({...p, outs_frac: (p.outs_frac! + 2)%3 as any}))} className="w-6 h-6 bg-slate-200 rounded text-xs">-</button>
                                    <span className="font-bold w-4 text-center">{pStats.outs_frac}</span>
                                    <button onClick={()=>setPStats(p=>({...p, outs_frac: (p.outs_frac! + 1)%3 as any}))} className="w-6 h-6 bg-slate-200 rounded text-xs">+</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Counter label="被安打" val={pStats.h} setVal={(v:number)=>setPStats(p=>({...p, h:v}))} />
                    <Counter label="被本塁打" val={pStats.hr} setVal={(v:number)=>setPStats(p=>({...p, hr:v}))} colorClass="bg-red-50 text-red-600" />
                    <Counter label="奪三振" val={pStats.k} setVal={(v:number)=>setPStats(p=>({...p, k:v}))} />
                    <Counter label="与四球" val={pStats.bb} setVal={(v:number)=>setPStats(p=>({...p, bb:v}))} />
                    <Counter label="与死球" val={pStats.hbp} setVal={(v:number)=>setPStats(p=>({...p, hbp:v}))} />
                    
                    <Counter label="失点" val={pStats.r} setVal={(v:number)=>setPStats(p=>({...p, r:v}))} />
                    <Counter label="自責点" val={pStats.er} setVal={(v:number)=>setPStats(p=>({...p, er:v}))} />
                    <Counter label="投球数" val={pStats.p_count} setVal={(v:number)=>setPStats(p=>({...p, p_count:v}))} step={5} />
                    <Counter label="暴投" val={pStats.wild_pitch} setVal={(v:number)=>setPStats(p=>({...p, wild_pitch:v}))} />
                </div>

                {/* Spray Chart Input for Pitcher Batch */}
                <div className="border-t pt-4">
                    <h4 className="text-sm font-bold text-slate-500 mb-2 flex items-center justify-between">
                        <span>打たれた位置を記録 (任意)</span>
                        <button onClick={handlePitcherBatchUndoSpray} className="text-xs bg-slate-100 px-2 py-1 rounded hover:bg-slate-200"><Undo2 size={12} className="inline mr-1"/>直前を取消</button>
                    </h4>
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                        <div className="relative w-48 h-48 bg-green-700 rounded-lg shadow-inner overflow-hidden cursor-crosshair flex-shrink-0">
                              <svg width="100%" height="100%" viewBox="0 0 100 100" onClick={handleFieldClick}>
                                  <rect width="100" height="100" fill="#15803d" />
                                  <line x1="50" y1="85" x2="0" y2="35" stroke="white" strokeWidth="0.5" />
                                  <line x1="50" y1="85" x2="100" y2="35" stroke="white" strokeWidth="0.5" />
                                  <path d="M 50 85 L 75 60 L 50 35 L 25 60 Z" fill="#a36936" opacity="0.8" />
                                  <path d="M 0 35 Q 50 -10 100 35" stroke="white" strokeWidth="0.5" fill="none" />
                                  {pStats.allowed_spray?.map((s,i) => (
                                      <circle key={i} cx={s.x} cy={s.y} r="2" fill={['1B','2B','3B','HR'].includes(s.result)?'yellow':'cyan'} stroke="black" strokeWidth="0.5" />
                                  ))}
                              </svg>
                        </div>
                        <div className="flex-1 space-y-2 w-full">
                            <div className="flex gap-1"><PitcherSprayButton res="1B" label="単打"/><PitcherSprayButton res="2B" label="二塁打"/><PitcherSprayButton res="3B" label="三塁打"/><PitcherSprayButton res="HR" label="本塁打"/></div>
                            <div className="flex gap-1"><PitcherSprayButton res="GO" label="ゴロ" type="out"/><PitcherSprayButton res="FO" label="フライ" type="out"/></div>
                            <p className="text-xs text-slate-400 mt-2">※ 上のボタンで球種(結果)を選んでから、左のフィールドをタップしてください。</p>
                        </div>
                    </div>
                </div>

                <button onClick={handlePitcherBatchSubmit} disabled={!selectedPlayerId} className="w-full py-4 mt-6 bg-red-600 text-white font-bold rounded-xl shadow hover:bg-red-700 disabled:bg-slate-300 transition">保存する</button>
            </div>
        </div>
      )}

      {/* Opponent Lineup Modal - Playing Phase (Unchanged) */}
      {oppLineupModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                  <button onClick={() => setOppLineupModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2"><Shield className="text-red-600"/> 相手交代・守備変更</h3>
                  <p className="text-xs text-slate-500 mb-4">{opponent} 所属選手のみ表示されます</p>
                  <div className="space-y-2 mb-6">
                      {opponentLineupIds.map((pid, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                              <span className="w-6 text-center font-bold text-slate-400 text-sm">{idx + 1}</span>
                              <select value={pid} onChange={(e) => handleOpponentLineupChange(idx, e.target.value)} className="flex-1 p-2 border rounded text-sm bg-slate-50 disabled:text-slate-400">
                                  <option value="">-- 選択 --</option>
                                  {opponentPlayers.map(p => (<option key={p.id} value={p.id} disabled={opponentLineupIds.includes(p.id) && p.id !== pid}>{p.name} #{p.number} {opponentLineupIds.includes(p.id) && p.id !== pid ? '(選択済)' : ''}</option>))}
                              </select>
                              {/* Position Input */}
                              <input type="text" placeholder="守備" className="w-16 p-2 border rounded text-sm text-center" value={opponentLineupPositions[idx] || ''} onChange={(e) => handleOpponentLineupPositionChange(idx, e.target.value)} />
                          </div>
                      ))}
                  </div>
                  <div className="border-t pt-4">
                      <h4 className="text-xs font-bold text-slate-500 mb-2">新規選手登録（クイック）</h4>
                      <div className="flex gap-2">
                          <input type="text" placeholder="選手名" className="flex-1 p-2 border rounded text-sm" value={newOppPlayerName} onChange={e=>setNewOppPlayerName(e.target.value)} />
                          <input type="text" placeholder="#" className="w-16 p-2 border rounded text-sm" value={newOppPlayerNumber} onChange={e=>setNewOppPlayerNumber(e.target.value)} />
                          <button onClick={handleQuickAddOpponentPlayer} className="bg-blue-600 text-white px-3 rounded font-bold hover:bg-blue-700"><Plus size={16}/></button>
                      </div>
                  </div>
                  <button onClick={() => setOppLineupModalOpen(false)} className="w-full mt-6 py-3 bg-slate-800 text-white font-bold rounded-lg shadow">変更を反映して戻る</button>
              </div>
          </div>
      )}

      {/* My Team Lineup Modal (Defensive Subs) - Playing Phase (Unchanged) */}
      {myLineupModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                  <button onClick={() => setMyLineupModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2"><Users className="text-team-navy"/> 自チーム交代・守備変更</h3>
                  <p className="text-xs text-slate-500 mb-4">守備交代や打順の入れ替えを行います。<br/>※ ここでの変更は「現在の打席」以降に反映されます。</p>
                  <div className="space-y-2 mb-6">
                      {myLineup.map((pid, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                              <span className="w-6 text-center font-bold text-slate-400 text-sm">{idx + 1}</span>
                              <select value={pid} onChange={(e) => handleLineupChange(idx, e.target.value)} className="flex-1 p-2 border rounded text-sm bg-slate-50 focus:bg-white transition">
                                  <option value="">-- 選択 --</option>
                                  {myTeamPlayers.filter(p => p.type !== 'pitcher').map(p => (
                                      <option key={p.id} value={p.id} disabled={myLineup.includes(p.id) && p.id !== pid}>{p.name} (#{p.number}) {p.position ? `(${p.position})` : ''} {myLineup.includes(p.id) && p.id !== pid ? '(出場中)' : ''}</option>
                                  ))}
                              </select>
                              {/* Position Input */}
                              <input type="text" placeholder="守備" className="w-16 p-2 border rounded text-sm text-center" value={myLineupPositions[idx] || ''} onChange={(e) => handleLineupPositionChange(idx, e.target.value)} />
                          </div>
                      ))}
                  </div>
                  <button onClick={() => setMyLineupModalOpen(false)} className="w-full mt-6 py-3 bg-team-navy text-white font-bold rounded-lg shadow">変更を反映して戻る</button>
              </div>
          </div>
      )}

      {/* ... (Other Modals: PH, OppPH, Review, Runner, Help - Unchanged) */}
      {phModalOpen && ( <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"> <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl relative"> <button onClick={() => setPhModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button> <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Users className="text-blue-600"/> 選手交代 (代打)</h3> <p className="text-xs text-slate-500 mb-3">現在の打者（{getBatterInLineup(0)?.name}）の代わりに打席に立つ選手を選択してください。</p> <div className="space-y-4"> <div> <label className="text-xs font-bold text-slate-400 mb-1 block">ベンチ入り選手</label> <div className="max-h-60 overflow-y-auto border rounded-lg divide-y"> {myTeamPlayers.filter(p => !myLineup.includes(p.id) && p.type !== 'pitcher').map(p => ( <button key={p.id} onClick={() => handlePinchHit(p.id)} className="w-full text-left p-3 hover:bg-blue-50 font-bold text-slate-700 flex justify-between"> <span>{p.name}</span><div className="text-slate-400 text-xs text-right"><span>#{p.number}</span>{p.position && <span className="ml-1">({p.position})</span>}</div> </button> ))} {myTeamPlayers.filter(p => !myLineup.includes(p.id) && p.type !== 'pitcher').length === 0 && <div className="p-4 text-center text-slate-400 text-xs">控え選手がいません</div>} </div> </div> </div> </div> </div> )}
      {oppPhModalOpen && ( <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"> <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl relative"> <button onClick={() => setOppPhModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button> <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Users className="text-red-600"/> 相手代打 (PH)</h3> <p className="text-xs text-slate-500 mb-3">現在の打者（{getOpponentBatter(0)?.name}）の代わりに打席に立つ選手を選択してください。</p> <div className="max-h-60 overflow-y-auto border rounded-lg divide-y"> {opponentPlayers.filter(p => !opponentLineupIds.includes(p.id)).map(p => ( <button key={p.id} onClick={() => handleOppPinchHit(p.id)} className="w-full text-left p-3 hover:bg-red-50 font-bold text-slate-700 flex justify-between"> <span>{p.name}</span><div className="text-slate-400 text-xs text-right"><span>#{p.number}</span></div> </button> ))} {opponentPlayers.filter(p => !opponentLineupIds.includes(p.id)).length === 0 && <div className="p-4 text-center text-slate-400 text-xs">控え選手がいません</div>} </div> </div> </div> )}
      {reviewModal.isOpen && ( <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-in fade-in"> <div className="bg-white w-full max-w-md rounded-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]"> <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2"><CheckCircle2 className="text-green-600"/> 走塁結果の確認</h3> <p className="text-sm text-slate-500 mb-4">打席結果: <span className="font-bold text-slate-800">{reviewModal.result === 'GIDP' ? '併殺打(GIDP)' : reviewModal.result}</span> <br/>走者の進塁先やアウトを確認・変更してください。</p> <div className="space-y-3 mb-6"> {reviewModal.runners.map((r, idx) => ( <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200"> <div className="flex justify-between items-center mb-2"> <span className="font-bold text-sm text-team-navy">{r.originalBase === 'batter' ? '打者走者' : r.originalBase === 'runner1' ? '1塁走者' : r.originalBase === 'runner2' ? '2塁走者' : '3塁走者'}: {r.playerName}</span> {r.isOut && <span className="bg-red-500 text-white text-[10px] px-2 py-1 rounded font-bold">OUT</span>}{r.isRun && <span className="bg-yellow-400 text-black text-[10px] px-2 py-1 rounded font-bold">得点</span>} </div> <div className="flex gap-1 overflow-x-auto pb-1"> <button onClick={()=>handleReviewChange(idx, 'dest', 'Out')} className={`px-3 py-2 rounded text-xs font-bold whitespace-nowrap border ${r.isOut ? 'bg-red-600 text-white border-red-600' : 'bg-white hover:bg-slate-100'}`}>アウト</button> <button onClick={()=>handleReviewChange(idx, 'dest', '1B')} className={`px-3 py-2 rounded text-xs font-bold whitespace-nowrap border ${r.dest==='1B' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-100'}`}>1塁</button> <button onClick={()=>handleReviewChange(idx, 'dest', '2B')} className={`px-3 py-2 rounded text-xs font-bold whitespace-nowrap border ${r.dest==='2B' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-100'}`}>2塁</button> <button onClick={()=>handleReviewChange(idx, 'dest', '3B')} className={`px-3 py-2 rounded text-xs font-bold whitespace-nowrap border ${r.dest==='3B' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-100'}`}>3塁</button> <button onClick={()=>handleReviewChange(idx, 'dest', 'Home')} className={`px-3 py-2 rounded text-xs font-bold whitespace-nowrap border ${r.dest==='Home' ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-white hover:bg-slate-100'}`}>本塁</button> </div> </div> ))} </div> <div className="flex gap-3"><button onClick={() => setReviewModal({isOpen:false, result:null, runners:[]})} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200">キャンセル</button><button onClick={confirmReview} className="flex-1 py-3 bg-team-navy text-white font-bold rounded-lg shadow hover:bg-slate-800">確定する</button></div> </div> </div> )}
      {runnerModal.isOpen && ( <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"> <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl relative"> <button onClick={() => setRunnerModal({isOpen:false, base: null})} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button> {getRunnerName(gameState[`${runnerModal.base!}Id` as keyof typeof gameState] as string) && getPlayerMiniStats(gameState[`${runnerModal.base!}Id` as keyof typeof gameState] as string) && ( <div className="bg-slate-800 text-white text-xs p-3 rounded mb-4"> <div className="flex justify-between items-center mb-1"><span className="font-bold text-sm">成績情報</span><span className="text-yellow-400 font-bold">盗塁: {getPlayerMiniStats(gameState[`${runnerModal.base!}Id` as keyof typeof gameState] as string)?.sb}</span></div> <div className="grid grid-cols-2 gap-2 text-slate-300"><span>打率: {getPlayerMiniStats(gameState[`${runnerModal.base!}Id` as keyof typeof gameState] as string)?.avg}</span><span>出塁: ---</span></div> </div> )} <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2"><Activity className="text-blue-600"/> 走者アクション</h3> <p className="text-sm text-slate-500 mb-6">{runnerModal.base === 'runner1' ? '1塁走者' : runnerModal.base === 'runner2' ? '2塁走者' : '3塁走者'}: <strong>{getRunnerName(gameState[`${runnerModal.base!}Id` as keyof typeof gameState] as string)}</strong></p> <div className="space-y-4"> <div> <label className="text-xs font-bold text-slate-400 mb-1 block">選手変更（代走など）</label> <select className="w-full p-2 border rounded font-bold" value={(gameState[`${runnerModal.base!}Id` as keyof typeof gameState] as string) || ''} onChange={(e) => handleRunnerAction('Change', e.target.value)}> <option value="">-- 走者を選択 --</option> {gameState.currentSide === 'Attack' ? (myTeamPlayers.filter(p => p.type!=='pitcher').map(p => (<option key={p.id} value={p.id}>{p.name} (#{p.number})</option>))) : (opponentPlayers.map(p => (<option key={p.id} value={p.id}>{p.name} #{p.number}</option>)))} </select> </div> <div className="grid grid-cols-2 gap-3"> <button onClick={() => handleRunnerAction('SB')} className="py-3 rounded-lg bg-blue-600 text-white font-bold shadow hover:bg-blue-700 flex items-center justify-center gap-2"><MoveRight size={18}/> 盗塁成功</button> <button onClick={() => handleRunnerAction('CS')} className="py-3 rounded-lg bg-red-100 text-red-700 font-bold border border-red-200 hover:bg-red-200 flex items-center justify-center gap-2"><X size={18}/> 盗塁死</button> <button onClick={() => handleRunnerAction('Advance')} className="py-3 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200">進塁 (WP/PB)</button> <button onClick={() => handleRunnerAction('Pickoff')} className="py-3 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200">牽制死</button> </div> <button onClick={() => handleRunnerAction('Clear')} className="w-full py-3 mt-2 rounded-lg border-2 border-slate-200 text-slate-400 font-bold hover:bg-slate-50 flex items-center justify-center gap-2"><UserMinus size={18}/> 走者を消去 (リセット)</button> </div> </div> </div> )}
      {/* Updated Log Modal with SNS Share */}
      {logModalOpen && ( <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"> <div className="bg-white w-full max-w-lg rounded-xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col"> <button onClick={() => setLogModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button> <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2"><FileText className="text-indigo-600"/> 試合ログ出力</h3> <p className="text-xs text-slate-500 mb-4">{date} vs {opponent}</p> 
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          <div className="bg-slate-50 border rounded-lg p-3">
              <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-slate-500">速報ログ (Text)</span><button onClick={() => copyToClipboard()} className="text-xs bg-white border px-2 py-1 rounded flex items-center gap-1 hover:bg-slate-50"><Copy size={12}/> コピー</button></div>
              <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">{getGameLogText()}</div>
          </div>
          <div className="bg-slate-50 border rounded-lg p-3">
              <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-slate-500">SNS投稿用 (Result)</span><button onClick={() => copyToClipboard(generateSNSPost())} className="text-xs bg-indigo-600 text-white border border-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-700 shadow-sm"><Share2 size={12}/> コピー</button></div>
              <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto bg-white border rounded p-2">{generateSNSPost()}</div>
          </div>
      </div>
      <div className="grid grid-cols-2 gap-2"> <button onClick={downloadLogText} className="flex flex-col items-center justify-center p-2 bg-white border rounded hover:bg-slate-50 text-xs font-bold text-slate-600"><Download size={16} className="mb-1"/> テキスト保存</button> <button onClick={downloadLogCSV} className="flex flex-col items-center justify-center p-2 bg-green-50 border border-green-200 rounded hover:bg-green-100 text-xs font-bold text-green-700"><Download size={16} className="mb-1"/> Excel(CSV)保存</button> </div> </div> </div> )}
      {helpModalOpen && ( <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"> <div className="bg-white w-full max-w-md rounded-xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"> <button onClick={() => setHelpModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button> <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><HelpCircle className="text-blue-600"/> 入力ガイド</h3> <div className="space-y-6 text-sm text-slate-600"> <div className="bg-blue-50 p-4 rounded-lg"> <h4 className="font-bold text-blue-800 mb-2">基本の流れ</h4> <p>1. <strong>打席結果ボタン</strong>を押すと、打者走者は自動で配置され、打順が次に進みます。<br/>2. 安打やエラーの場合、「走塁確認画面」が表示され、走者の進塁やアウトを調整できます。</p> </div> <div className="space-y-4"> <div> <h4 className="font-bold text-slate-800 flex items-center gap-2"><MoveRight size={16}/> 盗塁・暴投の入力タイミング</h4> <p className="mt-1"><strong>打席の途中（カウント中）の場合：</strong><br/>打席結果を入力する<u>前に</u>、塁上の走者ボタンをタップし、「盗塁」や「進塁」を選択してください。</p> <p className="mt-2 text-xs text-slate-500 bg-slate-100 p-2 rounded">例：2球目に盗塁 → 走者をタップして「盗塁成功」 → その後、打席完了時に「四球」などを入力。</p> </div> <div> <h4 className="font-bold text-slate-800 flex items-center gap-2"><Activity size={16}/> 併殺（ゲッツー）の入力</h4> <ul className="list-disc pl-5 space-y-1 mt-1"> <li><strong>ゴロでの併殺（6-4-3など）：</strong> 「併殺 (DP)」ボタンを押してください。自動的に走者がアウト扱いになります。必要に応じて走塁確認画面で調整してください。</li> <li><strong>ライナーでの併殺：</strong> 「ライナー(FO/GO)」を選択し、表示される走塁確認画面で、飛び出した走者を「アウト」にしてください。</li> </ul> </div> </div> </div> <button onClick={() => setHelpModalOpen(false)} className="w-full mt-6 py-3 bg-slate-800 text-white font-bold rounded-lg shadow">閉じる</button> </div> </div> )}
      
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 fixed bottom-10 right-10 z-50 shadow-xl ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          <AlertCircle size={20} />
          <span className="font-bold">{message.text}</span>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog 
          isOpen={resetModalOpen}
          title="試合終了・リセット"
          message={`現在の試合状態をリセットし、初期状態に戻しますか？\n記録されたデータは削除されませんが、入力中のランナーやカウント情報はクリアされます。`}
          onConfirm={executeResetGame}
          onCancel={() => setResetModalOpen(false)}
      />
    </div>
  );
};
