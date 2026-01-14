
import { Player, Opponent, PlateAppearance, GameBatchRecord, BatterStats, PitcherGameRecord, PitcherStats, PitcherPlayRecord } from '../types';
import { db } from './firebase';
import { doc, setDoc, deleteDoc } from "firebase/firestore";

const STORAGE_KEY_PLAYERS = 'indieball_players';
const STORAGE_KEY_OPPONENTS = 'indieball_opponents';
const STORAGE_KEY_PA = 'indieball_pa_records';
const STORAGE_KEY_BATCH = 'indieball_batch_records';
const STORAGE_KEY_PITCHER = 'indieball_pitcher_records';
const STORAGE_KEY_PITCHER_PLAY = 'indieball_pitcher_play_records';

// Helper for ID generation (Fallbacks for environments without crypto.randomUUID)
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// --- Firebase Sync Helpers ---
// Firestore doesn't like 'undefined', so we sanitize or assume valid objects.
// Using setDoc with merge: true or overwriting based on ID.

const syncToFirebase = async (collectionName: string, id: string, data: any) => {
    try {
        // Convert any undefined values to null (Firestore compatibility)
        const sanitized = JSON.parse(JSON.stringify(data)); 
        await setDoc(doc(db, collectionName, id), sanitized);
        console.log(`Synced to Firebase: ${collectionName}/${id}`);
    } catch (e) {
        console.error(`Firebase Sync Error (${collectionName}):`, e);
    }
};

const deleteFromFirebase = async (collectionName: string, id: string) => {
    try {
        await deleteDoc(doc(db, collectionName, id));
        console.log(`Deleted from Firebase: ${collectionName}/${id}`);
    } catch (e) {
        console.error(`Firebase Delete Error (${collectionName}):`, e);
    }
};


// --- INITIAL SAMPLE DATA ---

const DEFAULT_PLAYERS: Player[] = [
  { id: '1', name: '佐藤 健太', number: '1', position: 'CF', type: 'batter', throws: 'R', bats: 'L' }, // アベレージヒッター
  { id: '2', name: '田中 翔', number: '6', position: 'SS', type: 'batter', throws: 'R', bats: 'R' },   // 足が速い
  { id: '3', name: '鈴木 大輔', number: '55', position: '1B', type: 'batter', throws: 'R', bats: 'R' }, // パワーヒッター
  { id: '4', name: 'R. ジョンソン', number: '42', position: 'DH', type: 'batter', throws: 'L', bats: 'L' }, // 最強助っ人
  { id: '5', name: '高橋 優希', number: '2', position: 'C', type: 'batter', throws: 'R', bats: 'R' },   // 守備型
  { id: '6', name: '渡辺 徹', number: '5', position: '3B', type: 'batter', throws: 'R', bats: 'R' },
  { id: '7', name: '小林 誠', number: '8', position: 'RF', type: 'batter', throws: 'L', bats: 'L' },
  { id: '8', name: '加藤 剛', number: '9', position: 'LF', type: 'batter', throws: 'R', bats: 'S' }, // スイッチ
  { id: '9', name: '森田 学', number: '4', position: '2B', type: 'batter', throws: 'R', bats: 'R' },
  { id: '11', name: '伊藤 投手', number: '11', position: 'P', type: 'pitcher', throws: 'R', bats: 'R' }, // エース
  { id: '18', name: '山本 投手', number: '18', position: 'P', type: 'pitcher', throws: 'L', bats: 'L' }, // クローザー
  { id: '17', name: '佐々木 朗希風', number: '17', position: 'P', type: 'two-way', throws: 'R', bats: 'R' }, // 二刀流
];

const DEFAULT_OPPONENTS: Opponent[] = [
    { id: '1', name: 'レッドスターズ' },
    { id: '2', name: 'ブルーオーシャンズ' },
    { id: '3', name: 'グリーンフォレスト' },
    { id: '4', name: 'ブラックナイツ' },
];

// Sample Live Records (Play-by-play)
const DEFAULT_PA_RECORDS: PlateAppearance[] = [
    // Game 1 vs Red Stars (Win)
    { id: 'pa-1', gameId: '2024-04-01-レッドスターズ', date: '2024-04-01', opponent: 'レッドスターズ', playerId: '1', playerName: '佐藤 健太', inning: 1, isTop: true, runner1: false, runner2: false, runner3: false, result: '2B', direction: 8, rbi: 0, isSteal: false, coordX: 50, coordY: 20, vsHand: 'R' },
    { id: 'pa-2', gameId: '2024-04-01-レッドスターズ', date: '2024-04-01', opponent: 'レッドスターズ', playerId: '2', playerName: '田中 翔', inning: 1, isTop: true, runner1: false, runner2: true, runner3: false, result: '1B', direction: 9, rbi: 0, isSteal: false, coordX: 70, coordY: 40, vsHand: 'R' },
    { id: 'pa-sb-1', gameId: '2024-04-01-レッドスターズ', date: '2024-04-01', opponent: 'レッドスターズ', playerId: '2', playerName: '田中 翔', inning: 1, isTop: true, runner1: false, runner2: false, runner3: false, result: 'XI', direction: 0, rbi: 0, isSteal: true, vsHand: 'R' }, // Steal
    { id: 'pa-3', gameId: '2024-04-01-レッドスターズ', date: '2024-04-01', opponent: 'レッドスターズ', playerId: '3', playerName: '鈴木 大輔', inning: 1, isTop: true, runner1: false, runner2: true, runner3: true, result: 'HR', direction: 7, rbi: 3, isSteal: false, coordX: 20, coordY: 10, vsHand: 'R' },
    { id: 'pa-4', gameId: '2024-04-01-レッドスターズ', date: '2024-04-01', opponent: 'レッドスターズ', playerId: '4', playerName: 'R. ジョンソン', inning: 1, isTop: true, runner1: false, runner2: false, runner3: false, result: 'SO', direction: 0, rbi: 0, isSteal: false, vsHand: 'L' },
    
    // Game 2 vs Blue Oceans (Loss)
    { id: 'pa-5', gameId: '2024-04-08-ブルーオーシャンズ', date: '2024-04-08', opponent: 'ブルーオーシャンズ', playerId: '1', playerName: '佐藤 健太', inning: 1, isTop: true, runner1: false, runner2: false, runner3: false, result: 'GO', direction: 6, rbi: 0, isSteal: false, coordX: 45, coordY: 60, vsHand: 'R' },
    { id: 'pa-6', gameId: '2024-04-08-ブルーオーシャンズ', date: '2024-04-08', opponent: 'ブルーオーシャンズ', playerId: '3', playerName: '鈴木 大輔', inning: 2, isTop: true, runner1: false, runner2: false, runner3: false, result: 'SO', direction: 0, rbi: 0, isSteal: false, vsHand: 'R' },
    { id: 'pa-7', gameId: '2024-04-08-ブルーオーシャンズ', date: '2024-04-08', opponent: 'ブルーオーシャンズ', playerId: '4', playerName: 'R. ジョンソン', inning: 4, isTop: true, runner1: true, runner2: false, runner3: false, result: 'HR', direction: 5, rbi: 2, isSteal: false, coordX: 80, coordY: 5, vsHand: 'R' },
];

// Sample Batch Records (Historical)
const DEFAULT_BATCH_RECORDS: GameBatchRecord[] = [
    // 佐藤: Consistent Hitter
    { id: 'b-1', date: '2024-03-15', opponent: 'グリーンフォレスト', playerId: '1', playerName: '佐藤 健太', ab: 4, h: 3, double: 1, triple: 0, hr: 0, bb: 1, ibb: 0, hbp: 0, k: 0, sf: 0, sac: 0, r: 2, rbi: 1, sb: 1, cs: 0, gidp: 0 },
    { id: 'b-2', date: '2024-03-22', opponent: 'ブラックナイツ', playerId: '1', playerName: '佐藤 健太', ab: 5, h: 2, double: 0, triple: 1, hr: 0, bb: 0, ibb: 0, hbp: 0, k: 1, sf: 0, sac: 0, r: 1, rbi: 0, sb: 0, cs: 0, gidp: 0 },
    
    // 鈴木: Power but high K
    { id: 'b-3', date: '2024-03-15', opponent: 'グリーンフォレスト', playerId: '3', playerName: '鈴木 大輔', ab: 4, h: 1, double: 0, triple: 0, hr: 1, bb: 0, ibb: 0, hbp: 0, k: 3, sf: 0, sac: 0, r: 1, rbi: 2, sb: 0, cs: 0, gidp: 0 },
    { id: 'b-4', date: '2024-03-22', opponent: 'ブラックナイツ', playerId: '3', playerName: '鈴木 大輔', ab: 3, h: 0, double: 0, triple: 0, hr: 0, bb: 2, ibb: 0, hbp: 0, k: 1, sf: 0, sac: 0, r: 0, rbi: 0, sb: 0, cs: 0, gidp: 1 },

    // ジョンソン: God mode
    { id: 'b-5', date: '2024-03-15', opponent: 'グリーンフォレスト', playerId: '4', playerName: 'R. ジョンソン', ab: 3, h: 2, double: 1, triple: 0, hr: 1, bb: 2, ibb: 1, hbp: 0, k: 0, sf: 0, sac: 0, r: 3, rbi: 4, sb: 0, cs: 0, gidp: 0 },
];

// Sample Pitcher Records (Batch - Historical Games)
const DEFAULT_PITCHER_RECORDS: PitcherGameRecord[] = [
    // 伊藤 (Starter)
    { 
        id: 'p-1', date: '2024-03-15', opponent: 'グリーンフォレスト', playerId: '11', playerName: '伊藤 投手', isStarter: true, result: 'W',
        outs: 21, h: 4, hr: 0, r: 1, er: 1, bb: 2, ibb: 0, hbp: 0, k: 8, wild_pitch: 0, p_count: 95,
        ab: 25, h2: 1, h3: 0, sac: 0, sf: 0, go: 8, fo: 5, run_support: 5, support_innings: 7, stop_win_streak: false, stop_loss_streak: false, allowed_spray: []
    },
    { 
        id: 'p-2', date: '2024-03-29', opponent: 'ブラックナイツ', playerId: '11', playerName: '伊藤 投手', isStarter: true, result: null,
        outs: 18, h: 6, hr: 1, r: 3, er: 3, bb: 1, ibb: 0, hbp: 1, k: 5, wild_pitch: 1, p_count: 88,
        ab: 23, h2: 0, h3: 0, sac: 1, sf: 0, go: 7, fo: 6, run_support: 2, support_innings: 6, stop_win_streak: false, stop_loss_streak: false, allowed_spray: []
    },
    
    // 山本 (Closer)
    { 
        id: 'p-3', date: '2024-03-15', opponent: 'グリーンフォレスト', playerId: '18', playerName: '山本 投手', isStarter: false, result: 'SV',
        outs: 3, h: 0, hr: 0, r: 0, er: 0, bb: 0, ibb: 0, hbp: 0, k: 2, wild_pitch: 0, p_count: 12,
        ab: 3, h2: 0, h3: 0, sac: 0, sf: 0, go: 1, fo: 0, run_support: 0, support_innings: 0, stop_win_streak: false, stop_loss_streak: false, allowed_spray: []
    },
    { 
        id: 'p-4', date: '2024-04-01', opponent: 'レッドスターズ', playerId: '18', playerName: '山本 投手', isStarter: false, result: 'SV',
        outs: 4, h: 1, hr: 0, r: 0, er: 0, bb: 1, ibb: 0, hbp: 0, k: 1, wild_pitch: 0, p_count: 20,
        ab: 5, h2: 0, h3: 0, sac: 0, sf: 0, go: 2, fo: 1, run_support: 0, support_innings: 0, stop_win_streak: false, stop_loss_streak: false, allowed_spray: []
    }
];

// Sample Pitcher Play Records (Live Logs)
// Corresponding to Game 1 (2024-04-01 vs Red Stars) - Ito pitching
const DEFAULT_PITCHER_PLAY_RECORDS: PitcherPlayRecord[] = [
    { id: 'pp-1', gameId: '2024-04-01-レッドスターズ', date: '2024-04-01', opponent: 'レッドスターズ', playerId: '11', playerName: '伊藤 投手', inning: 1, result: 'SO', isOut: true, runScored: 0, earnedRun: 0, vsHand: 'R' },
    { id: 'pp-2', gameId: '2024-04-01-レッドスターズ', date: '2024-04-01', opponent: 'レッドスターズ', playerId: '11', playerName: '伊藤 投手', inning: 1, result: 'GO', isOut: true, runScored: 0, earnedRun: 0, coordX: 40, coordY: 60, vsHand: 'L' },
    { id: 'pp-3', gameId: '2024-04-01-レッドスターズ', date: '2024-04-01', opponent: 'レッドスターズ', playerId: '11', playerName: '伊藤 投手', inning: 1, result: 'SO', isOut: true, runScored: 0, earnedRun: 0, vsHand: 'R' },
    
    { id: 'pp-4', gameId: '2024-04-01-レッドスターズ', date: '2024-04-01', opponent: 'レッドスターズ', playerId: '11', playerName: '伊藤 投手', inning: 2, result: '1B', isOut: false, runScored: 0, earnedRun: 0, coordX: 80, coordY: 30, vsHand: 'L' }, // Hit to RF
    { id: 'pp-5', gameId: '2024-04-01-レッドスターズ', date: '2024-04-01', opponent: 'レッドスターズ', playerId: '11', playerName: '伊藤 投手', inning: 2, result: 'HR', isOut: false, runScored: 2, earnedRun: 2, coordX: 10, coordY: 10, vsHand: 'R' }, // 2-run HR to LF
    // FIX: pp-6 had earnedRun: 2 on a Fly Out. Should be 0.
    { id: 'pp-6', gameId: '2024-04-01-レッドスターズ', date: '2024-04-01', opponent: 'レッドスターズ', playerId: '11', playerName: '伊藤 投手', inning: 2, result: 'FO', isOut: true, runScored: 0, earnedRun: 0, coordX: 50, coordY: 80, vsHand: 'R' },
];


// --- Player Management ---
export const getPlayers = (): Player[] => {
  const stored = localStorage.getItem(STORAGE_KEY_PLAYERS);
  if (stored) return JSON.parse(stored);
  return DEFAULT_PLAYERS;
};
export const savePlayer = (player: Player): void => {
    const players = getPlayers();
    // Check if update or new
    const idx = players.findIndex(p => p.id === player.id);
    if (idx >= 0) {
        players[idx] = player;
    } else {
        players.push(player);
    }
    localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(players));
    
    // Sync to Firebase
    syncToFirebase('players', player.id, player);
};
export const deletePlayer = (id: string): void => {
    const players = getPlayers();
    localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(players.filter(p => p.id !== id)));
    deleteFromFirebase('players', id);
};

// --- Opponent Management ---
export const getOpponents = (): Opponent[] => {
    const stored = localStorage.getItem(STORAGE_KEY_OPPONENTS);
    if (stored) return JSON.parse(stored);
    return DEFAULT_OPPONENTS;
};
export const saveOpponent = (opponent: Opponent): void => {
    const list = getOpponents();
    const idx = list.findIndex(o => o.id === opponent.id);
    if (idx >= 0) {
        list[idx] = opponent;
    } else {
        list.push(opponent);
    }
    localStorage.setItem(STORAGE_KEY_OPPONENTS, JSON.stringify(list));
    syncToFirebase('opponents', opponent.id, opponent);
};
export const deleteOpponent = (id: string): void => {
    const list = getOpponents();
    localStorage.setItem(STORAGE_KEY_OPPONENTS, JSON.stringify(list.filter(o => o.id !== id)));
    deleteFromFirebase('opponents', id);
};

// --- Batter Records ---
export const getPARecords = (): PlateAppearance[] => {
  const stored = localStorage.getItem(STORAGE_KEY_PA);
  if (stored) return JSON.parse(stored);
  return DEFAULT_PA_RECORDS;
};
export const savePARecord = (record: PlateAppearance): void => {
  const records = getPARecords();
  localStorage.setItem(STORAGE_KEY_PA, JSON.stringify([...records, record]));
  syncToFirebase('pa_records', record.id, record);
};
export const updatePARecord = (record: PlateAppearance): void => {
  const records = getPARecords();
  const index = records.findIndex(r => r.id === record.id);
  if (index !== -1) {
    records[index] = record;
    localStorage.setItem(STORAGE_KEY_PA, JSON.stringify(records));
    syncToFirebase('pa_records', record.id, record);
  }
};
export const deletePARecord = (id: string): void => {
  const records = getPARecords();
  localStorage.setItem(STORAGE_KEY_PA, JSON.stringify(records.filter(r => r.id !== id)));
  deleteFromFirebase('pa_records', id);
};

export const getBatchRecords = (): GameBatchRecord[] => {
  const stored = localStorage.getItem(STORAGE_KEY_BATCH);
  if (stored) return JSON.parse(stored);
  return DEFAULT_BATCH_RECORDS;
};
export const saveBatchRecord = (record: GameBatchRecord): void => {
  const records = getBatchRecords();
  localStorage.setItem(STORAGE_KEY_BATCH, JSON.stringify([...records, record]));
  syncToFirebase('batch_records', record.id, record);
};
export const updateBatchRecord = (record: GameBatchRecord): void => {
  const records = getBatchRecords();
  const index = records.findIndex(r => r.id === record.id);
  if (index !== -1) {
    records[index] = record;
    localStorage.setItem(STORAGE_KEY_BATCH, JSON.stringify(records));
    syncToFirebase('batch_records', record.id, record);
  }
};
export const deleteBatchRecord = (id: string): void => {
  const records = getBatchRecords();
  localStorage.setItem(STORAGE_KEY_BATCH, JSON.stringify(records.filter(r => r.id !== id)));
  deleteFromFirebase('batch_records', id);
};

// --- Pitcher Records (Batch) ---
export const getPitcherRecords = (): PitcherGameRecord[] => {
  const stored = localStorage.getItem(STORAGE_KEY_PITCHER);
  if (stored) return JSON.parse(stored);
  return DEFAULT_PITCHER_RECORDS;
};
export const savePitcherRecord = (record: PitcherGameRecord): void => {
  const records = getPitcherRecords();
  localStorage.setItem(STORAGE_KEY_PITCHER, JSON.stringify([...records, record]));
  syncToFirebase('pitcher_records', record.id, record);
};
export const updatePitcherRecord = (record: PitcherGameRecord): void => {
  const records = getPitcherRecords();
  const index = records.findIndex(r => r.id === record.id);
  if (index !== -1) {
    records[index] = record;
    localStorage.setItem(STORAGE_KEY_PITCHER, JSON.stringify(records));
    syncToFirebase('pitcher_records', record.id, record);
  }
};
export const deletePitcherRecord = (id: string): void => {
  const records = getPitcherRecords();
  localStorage.setItem(STORAGE_KEY_PITCHER, JSON.stringify(records.filter(r => r.id !== id)));
  deleteFromFirebase('pitcher_records', id);
};

// --- Pitcher Play Records (Live) ---
export const getPitcherPlayRecords = (): PitcherPlayRecord[] => {
  const stored = localStorage.getItem(STORAGE_KEY_PITCHER_PLAY);
  if (stored) return JSON.parse(stored);
  return DEFAULT_PITCHER_PLAY_RECORDS;
};
export const savePitcherPlayRecord = (record: PitcherPlayRecord): void => {
  const records = getPitcherPlayRecords();
  localStorage.setItem(STORAGE_KEY_PITCHER_PLAY, JSON.stringify([...records, record]));
  syncToFirebase('pitcher_play_records', record.id, record);
};
export const updatePitcherPlayRecord = (record: PitcherPlayRecord): void => {
  const records = getPitcherPlayRecords();
  const index = records.findIndex(r => r.id === record.id);
  if (index !== -1) {
    records[index] = record;
    localStorage.setItem(STORAGE_KEY_PITCHER_PLAY, JSON.stringify(records));
    syncToFirebase('pitcher_play_records', record.id, record);
  }
};
export const deletePitcherPlayRecord = (id: string): void => {
  const records = getPitcherPlayRecords();
  localStorage.setItem(STORAGE_KEY_PITCHER_PLAY, JSON.stringify(records.filter(r => r.id !== id)));
  deleteFromFirebase('pitcher_play_records', id);
};

// --- Unified Export ---
export const exportUnifiedCSV = (
    batterStats: BatterStats[], 
    pitcherStats: PitcherStats[]
): void => {
  const paRecords = getPARecords();
  const batchRecords = getBatchRecords();
  const pitcherRecords = getPitcherRecords();
  const pitcherPlayRecords = getPitcherPlayRecords();

  let csvContent = '\uFEFF'; // BOM

  // 1. Batter Stats
  csvContent += "=== 野手成績サマリー (Batter Stats) ===\n";
  const bHeaders = [
    "選手名","試合","打席","打数","安打","二塁打","三塁打","本塁打","塁打","打点","得点","三振","四球","敬遠","死球","犠打","犠飛",
    "盗塁","盗塁死","成功率","併殺打",
    "打率","出塁率","長打率","OPS","得点圏打率",
    "NOI","GPA","RC","RC27","XR","XR27","RCAA","XR+","RCWIN","XRWIN",
    "IsoD","IsoP","BB/K","PA/BB","PA/K","AB/HR","SecA","TA","PS","TTO","TTO率","BABIP",
    "打球左","打球中","打球右","HR勝敗",
    "対右打率","対右OPS","対左打率","対左OPS",
    "マルチ安","猛打賞","固め打ち","マルチ本","3打点超","2得点超","3三振超","2四死超","マルチ盗"
  ];
  csvContent += bHeaders.join(",") + "\n";
  
  csvContent += batterStats.map(s => {
      const singles = s.h - (s.double + s.triple + s.hr);
      const tb = singles + (s.double*2) + (s.triple*3) + (s.hr*4);
      const sbPct = (s.sb + s.cs) > 0 ? (s.sb / (s.sb + s.cs)) * 100 : 0;

      return [
        `"${s.name}"`, s.games, s.pa, s.ab, s.h, s.double, s.triple, s.hr, tb, s.rbi, s.r, s.so, s.bb, s.ibb, s.hbp, s.sac, s.sf,
        s.sb, s.cs, sbPct.toFixed(1)+'%', s.gidp,
        s.avg.toFixed(3), s.obp.toFixed(3), s.slg.toFixed(3), s.ops.toFixed(3), s.risp_avg.toFixed(3),
        s.noi.toFixed(0), s.gpa.toFixed(3), s.rc.toFixed(2), s.rc27.toFixed(2), s.xr.toFixed(2), s.xr27.toFixed(2),
        s.rcaa.toFixed(2), s.xr_plus.toFixed(2), s.rcwin.toFixed(2), s.xrwin.toFixed(2),
        s.iso_d.toFixed(3), s.iso_p.toFixed(3), s.bb_k.toFixed(2), s.pa_bb.toFixed(2), s.pa_k.toFixed(2), s.ab_hr.toFixed(2),
        s.sec_a.toFixed(3), s.ta.toFixed(3), s.ps.toFixed(2), s.tto, (s.tto_rate*100).toFixed(1)+'%', s.babip.toFixed(3),
        s.dir_left, s.dir_center, s.dir_right, `"${s.hr_win_loss}"`,
        s.avg_vs_r.toFixed(3), s.ops_vs_r.toFixed(3), s.avg_vs_l.toFixed(3), s.ops_vs_l.toFixed(3),
        s.multi_hit, s.mouda, s.katame, s.multi_hr, s.multi_rbi, s.multi_r, s.multi_k, s.multi_bb, s.multi_sb
      ].join(',');
  }).join('\n');
  csvContent += "\n\n";

  // 2. Pitcher Stats
  csvContent += "=== 投手成績サマリー (Pitcher Stats) ===\n";
  const pHeaders = [
      "選手名","試合","防御率","勝","負","S","H","HP","SP","救勝","救敗","勝率",
      "回","投球数","P/IP","完投","完封","QS率","HQS率","SQS率",
      "被安打","被本","失点","自責","四球","死球","敬遠","暴投","三振",
      "WHIP","K/BB","奪三振率","与四球率","被本率",
      "被打率","BABIP","被出塁率","被長打率","GO/AO",
      "対右被打率","対右被OPS","対左被打率","対左被OPS",
      "援護率","FIP","LOB%","RSAA","RSWIN","PR","KD",
      "連投(試)","連投(日)","100球超","連勝STP","連敗STP"
  ];
  csvContent += pHeaders.join(",") + "\n";
  
  csvContent += pitcherStats.map(p => [
      `"${p.name}"`, p.games, p.era.toFixed(2), p.wins, p.losses, p.saves, p.holds, p.hp, p.sp, p.relief_wins, p.relief_losses, p.win_rate.toFixed(3),
      `"${p.ipDisplay}"`, p.p_count, p.p_ip.toFixed(2), 0, 0, // 完投完封は未実装
      (p.qs_rate*100).toFixed(1)+'%', (p.hqs_rate*100).toFixed(1)+'%', (p.sqs_rate*100).toFixed(1)+'%',
      p.h, p.hr, p.r, p.er, p.bb, p.hbp, p.ibb, p.wild_pitch, p.k,
      p.whip.toFixed(2), p.k_bb.toFixed(2), p.k_rate.toFixed(2), p.bb_rate.toFixed(2), p.hr_9.toFixed(2),
      p.baa.toFixed(3), p.babip.toFixed(3), p.oba.toFixed(3), p.slg_allowed.toFixed(3), p.go_ao.toFixed(2),
      p.baa_vs_r.toFixed(3), p.ops_allowed_vs_r.toFixed(3), p.baa_vs_l.toFixed(3), p.ops_allowed_vs_l.toFixed(3),
      p.run_support_rate.toFixed(2), p.fip.toFixed(2), (p.lob_pct*100).toFixed(1)+'%', p.rsaa.toFixed(2), p.rswin.toFixed(2), p.pr.toFixed(2), p.kokendo,
      p.consecutive_games, p.consecutive_days, p.count_100pitches, p.stop_win_streak_count, p.stop_loss_streak_count
  ].join(',')).join('\n');
  csvContent += "\n\n";

  // 3. Raw Logs
  csvContent += "=== 記録ログ (Raw Logs) ===\n";
  csvContent += "Type,ID,日付,対戦相手,選手名,詳細,打球X,打球Y,対戦手\n";
  paRecords.forEach(r => {
      csvContent += `野手速報,${r.id},${r.date},"${r.opponent}","${r.playerName}",${r.inning}回 ${r.result} (打点${r.rbi}),${r.coordX||''},${r.coordY||''},VS ${r.vsHand||'-'}\n`;
  });
  batchRecords.forEach(r => {
      csvContent += `野手一括,${r.id},${r.date},"${r.opponent}","${r.playerName}",${r.ab}打数${r.h}安打 ${r.rbi}打点,,-\n`;
  });
  pitcherPlayRecords.forEach(r => {
      csvContent += `投手速報,${r.id},${r.date},"${r.opponent}","${r.playerName}",${r.inning}回 ${r.result},${r.coordX||''},${r.coordY||''},VS ${r.vsHand||'-'}\n`;
  });
  csvContent += "\n\n";

  // 4. Raw Pitcher Batch Logs
  csvContent += "=== 投手一括記録ログ (Raw Pitcher Batch Logs) ===\n";
  csvContent += "ID,日付,対戦相手,選手名,起用,結果,回(Outs),球数,被安打,被打数,被二,被三,被本,失点,自責,四球,死球,暴投,敬遠,三振,GO,FO,援護点,援護回,STP\n";
  pitcherRecords.forEach(r => {
      const ip = Math.floor(r.outs/3) + (r.outs%3 === 1 ? ".1" : r.outs%3 === 2 ? ".2" : ".0");
      const role = r.isStarter ? '先発' : '救援';
      const stp = [];
      if(r.stop_win_streak) stp.push('連勝止');
      if(r.stop_loss_streak) stp.push('連敗止');
      
      csvContent += `${r.id},${r.date},"${r.opponent}","${r.playerName}",${role},${r.result||'-'},${ip},${r.p_count},`
                  + `${r.h},${r.ab},${r.h2},${r.h3},${r.hr},${r.r},${r.er},${r.bb},${r.hbp},${r.wild_pitch},${r.ibb},${r.k},`
                  + `${r.go},${r.fo},${r.run_support},${r.support_innings},"${stp.join('/')}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `indieball_complete_data_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- Backup & Restore (JSON) ---
export const getAllDataJSON = (): string => {
    const data = {
        players: getPlayers(),
        opponents: getOpponents(),
        paRecords: getPARecords(),
        batchRecords: getBatchRecords(),
        pitcherRecords: getPitcherRecords(),
        pitcherPlayRecords: getPitcherPlayRecords(),
        timestamp: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
};

export const importDataJSON = (jsonString: string): boolean => {
    try {
        const data = JSON.parse(jsonString);
        if(!data.players) return false; // Minimal validation

        localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(data.players));
        localStorage.setItem(STORAGE_KEY_OPPONENTS, JSON.stringify(data.opponents || []));
        localStorage.setItem(STORAGE_KEY_PA, JSON.stringify(data.paRecords || []));
        localStorage.setItem(STORAGE_KEY_BATCH, JSON.stringify(data.batchRecords || []));
        localStorage.setItem(STORAGE_KEY_PITCHER, JSON.stringify(data.pitcherRecords || []));
        if(data.pitcherPlayRecords) {
            localStorage.setItem(STORAGE_KEY_PITCHER_PLAY, JSON.stringify(data.pitcherPlayRecords));
        }
        return true;
    } catch (e) {
        console.error("Import failed", e);
        return false;
    }
};
