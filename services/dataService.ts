import { Player, Opponent, PlateAppearance, GameBatchRecord, BatterStats, PitcherGameRecord, PitcherStats } from '../types';

const STORAGE_KEY_PLAYERS = 'indieball_players';
const STORAGE_KEY_OPPONENTS = 'indieball_opponents';
const STORAGE_KEY_PA = 'indieball_pa_records';
const STORAGE_KEY_BATCH = 'indieball_batch_records';
const STORAGE_KEY_PITCHER = 'indieball_pitcher_records';

// Helper for ID generation (Fallbacks for environments without crypto.randomUUID)
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Initial Mock Data
const DEFAULT_PLAYERS: Player[] = [
  { id: '1', name: '佐藤 健太', number: '1', position: 'OF', type: 'batter' },
  { id: '2', name: '田中 翔', number: '6', position: 'SS', type: 'batter' },
  { id: '3', name: '鈴木 大輔', number: '55', position: '1B', type: 'batter' },
  { id: '4', name: 'R. ジョンソン', number: '42', position: 'DH', type: 'batter' },
  { id: '5', name: '高橋 優希', number: '2', position: 'C', type: 'batter' },
  { id: '11', name: '伊藤 投手', number: '11', position: 'P', type: 'pitcher' },
  { id: '18', name: '山本 投手', number: '18', position: 'P', type: 'pitcher' },
];

const DEFAULT_OPPONENTS: Opponent[] = [
    { id: '1', name: 'レッドスターズ' },
    { id: '2', name: 'ブルーオーシャンズ' },
    { id: '3', name: 'グリーンフォレスト' },
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
};
export const deletePlayer = (id: string): void => {
    const players = getPlayers();
    localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(players.filter(p => p.id !== id)));
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
};
export const deleteOpponent = (id: string): void => {
    const list = getOpponents();
    localStorage.setItem(STORAGE_KEY_OPPONENTS, JSON.stringify(list.filter(o => o.id !== id)));
};

// --- Batter Records ---
export const getPARecords = (): PlateAppearance[] => {
  const stored = localStorage.getItem(STORAGE_KEY_PA);
  if (stored) return JSON.parse(stored);
  return [];
};
export const savePARecord = (record: PlateAppearance): void => {
  const records = getPARecords();
  localStorage.setItem(STORAGE_KEY_PA, JSON.stringify([...records, record]));
};
export const deletePARecord = (id: string): void => {
  const records = getPARecords();
  localStorage.setItem(STORAGE_KEY_PA, JSON.stringify(records.filter(r => r.id !== id)));
};

export const getBatchRecords = (): GameBatchRecord[] => {
  const stored = localStorage.getItem(STORAGE_KEY_BATCH);
  if (stored) return JSON.parse(stored);
  return [];
};
export const saveBatchRecord = (record: GameBatchRecord): void => {
  const records = getBatchRecords();
  localStorage.setItem(STORAGE_KEY_BATCH, JSON.stringify([...records, record]));
};
export const deleteBatchRecord = (id: string): void => {
  const records = getBatchRecords();
  localStorage.setItem(STORAGE_KEY_BATCH, JSON.stringify(records.filter(r => r.id !== id)));
};

// --- Pitcher Records ---
export const getPitcherRecords = (): PitcherGameRecord[] => {
  const stored = localStorage.getItem(STORAGE_KEY_PITCHER);
  if (stored) return JSON.parse(stored);
  return [];
};
export const savePitcherRecord = (record: PitcherGameRecord): void => {
  const records = getPitcherRecords();
  localStorage.setItem(STORAGE_KEY_PITCHER, JSON.stringify([...records, record]));
};
export const deletePitcherRecord = (id: string): void => {
  const records = getPitcherRecords();
  localStorage.setItem(STORAGE_KEY_PITCHER, JSON.stringify(records.filter(r => r.id !== id)));
};

// --- Unified Export ---
export const exportUnifiedCSV = (
    batterStats: BatterStats[], 
    pitcherStats: PitcherStats[]
): void => {
  const paRecords = getPARecords();
  const batchRecords = getBatchRecords();
  const pitcherRecords = getPitcherRecords();

  let csvContent = '\uFEFF'; // BOM

  // 1. Batter Stats
  csvContent += "=== 野手成績サマリー (Batter Stats) ===\n";
  const bHeaders = [
    "選手名","試合","打席","打数","安打","二塁打","三塁打","本塁打","塁打","打点","得点","三振","四球","敬遠","死球","犠打","犠飛",
    "盗塁","盗塁死","成功率","併殺打",
    "打率","出塁率","長打率","OPS","得点圏打率","内安率",
    "NOI","GPA","RC","RC27","XR","XR27","RCAA","XR+","RCWIN","XRWIN",
    "IsoD","IsoP","BB/K","PA/BB","PA/K","AB/HR","SecA","TA","PS","TTO","TTO率","BABIP",
    "打球左","打球中","打球右","HR勝敗",
    "マルチ安","猛打賞","固め打ち","マルチ本","3打点超","2得点超","3三振超","2四死超","マルチ盗"
  ];
  csvContent += bHeaders.join(",") + "\n";
  
  csvContent += batterStats.map(s => {
      const singles = s.h - (s.double + s.triple + s.hr);
      const tb = singles + (s.double*2) + (s.triple*3) + (s.hr*4);
      const sbPct = (s.sb + s.cs) > 0 ? (s.sb / (s.sb + s.cs)) * 100 : 0;
      // Inner Hit Rate (Approx as we don't assume inner hit input yet, just placeholder or 0)
      const innerHitRate = 0; 

      return [
        `"${s.name}"`, s.games, s.pa, s.ab, s.h, s.double, s.triple, s.hr, tb, s.rbi, s.r, s.so, s.bb, s.ibb, s.hbp, s.sac, s.sf,
        s.sb, s.cs, sbPct.toFixed(1)+'%', s.gidp,
        s.avg.toFixed(3), s.obp.toFixed(3), s.slg.toFixed(3), s.ops.toFixed(3), s.risp_avg.toFixed(3), innerHitRate.toFixed(1)+'%',
        s.noi.toFixed(0), s.gpa.toFixed(3), s.rc.toFixed(2), s.rc27.toFixed(2), s.xr.toFixed(2), s.xr27.toFixed(2),
        s.rcaa.toFixed(2), s.xr_plus.toFixed(2), s.rcwin.toFixed(2), s.xrwin.toFixed(2),
        s.iso_d.toFixed(3), s.iso_p.toFixed(3), s.bb_k.toFixed(2), s.pa_bb.toFixed(2), s.pa_k.toFixed(2), s.ab_hr.toFixed(2),
        s.sec_a.toFixed(3), s.ta.toFixed(3), s.ps.toFixed(2), s.tto, (s.tto_rate*100).toFixed(1)+'%', s.babip.toFixed(3),
        s.dir_left, s.dir_center, s.dir_right, `"${s.hr_win_loss}"`,
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
      p.run_support_rate.toFixed(2), p.fip.toFixed(2), (p.lob_pct*100).toFixed(1)+'%', p.rsaa.toFixed(2), p.rswin.toFixed(2), p.pr.toFixed(2), p.kokendo,
      p.consecutive_games, p.consecutive_days, p.count_100pitches, p.stop_win_streak_count, p.stop_loss_streak_count
  ].join(',')).join('\n');
  csvContent += "\n\n";

  // 3. Raw Batter Data
  csvContent += "=== 野手記録ログ (Raw Batter Logs) ===\n";
  csvContent += "Type,ID,日付,対戦相手,選手名,詳細,打球X,打球Y\n";
  paRecords.forEach(r => {
      csvContent += `速報,${r.id},${r.date},"${r.opponent}","${r.playerName}",${r.inning}回 ${r.result} (打点${r.rbi}),${r.coordX||''},${r.coordY||''}\n`;
  });
  batchRecords.forEach(r => {
      csvContent += `一括,${r.id},${r.date},"${r.opponent}","${r.playerName}",${r.ab}打数${r.h}安打 ${r.rbi}打点,,\n`;
  });
  csvContent += "\n\n";

  // 4. Raw Pitcher Data
  csvContent += "=== 投手記録ログ (Raw Pitcher Logs) ===\n";
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
        return true;
    } catch (e) {
        console.error("Import failed", e);
        return false;
    }
};