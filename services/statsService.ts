
import { PlateAppearance, GameBatchRecord, BatterStats, PitcherGameRecord, PitcherStats, PositionNum, PitcherPlayRecord } from '../types';
import { getPitcherPlayRecords } from './dataService';

// League Batter Helpers
interface LeagueBatterStats {
    totalPA: number;
    totalRC: number;
    totalXR: number;
    totalRuns: number;
    totalInnings: number; // For RPW (approx)
}

const calculateLeagueBatterStats = (batters: BatterStats[]): LeagueBatterStats => {
    let pa=0, rc=0, xr=0, runs=0;
    batters.forEach(b => {
        pa += b.pa;
        rc += b.rc;
        xr += b.xr;
        runs += b.r;
    });
    // Approx league innings from PA. 
    return { totalPA: pa, totalRC: rc, totalXR: xr, totalRuns: runs, totalInnings: pa / 4.2 };
};

export const calculateBatterStats = (liveRecords: PlateAppearance[], batchRecords: GameBatchRecord[], leagueStats?: LeagueBatterStats): BatterStats => {
  const t: BatterStats = {
    playerId: liveRecords[0]?.playerId || batchRecords[0]?.playerId || '',
    name: liveRecords[0]?.playerName || batchRecords[0]?.playerName || '',
    games: new Set([...liveRecords.map(r => r.date+r.opponent), ...batchRecords.map(r => r.date+r.opponent)]).size,
    
    pa: 0, ab: 0, h: 0, double: 0, triple: 0, hr: 0,
    bb: 0, ibb: 0, hbp: 0, so: 0, sf: 0, sac: 0, r: 0, rbi: 0,
    sb: 0, cs: 0, gidp: 0,
    
    avg: 0, obp: 0, slg: 0, ops: 0, noi: 0, gpa: 0,
    rc: 0, rc27: 0, xr: 0, xr27: 0,
    babip: 0, iso_p: 0, iso_d: 0, 
    risp_avg: 0, risp_ab: 0, risp_h: 0,

    rcaa: 0, xr_plus: 0, rcwin: 0, xrwin: 0,
    bb_k: 0, pa_bb: 0, pa_k: 0, ab_hr: 0,
    sec_a: 0, ta: 0, ps: 0, tto: 0, tto_rate: 0,
    
    dir_left: 0, dir_center: 0, dir_right: 0,
    
    multi_hit: 0, mouda: 0, katame: 0, multi_hr: 0, multi_rbi: 0, 
    multi_r: 0, multi_k: 0, multi_bb: 0, multi_sb: 0, multi_error: 0,
    hr_win_loss: '',
    
    ab_vs_r: 0, h_vs_r: 0, hr_vs_r: 0, ops_vs_r: 0, avg_vs_r: 0,
    ab_vs_l: 0, h_vs_l: 0, hr_vs_l: 0, ops_vs_l: 0, avg_vs_l: 0,

    spray_data: []
  };

  // Split helpers
  let obp_num_vs_r = 0, obp_denom_vs_r = 0, tb_vs_r = 0;
  let obp_num_vs_l = 0, obp_denom_vs_l = 0, tb_vs_l = 0;

  // --- 1. Aggregation & Game Grouping ---
  const gameMap = new Map<string, {
      h: number, hr: number, rbi: number, r: number, k: number, bb: number, sb: number
  }>();

  const getGameStats = (gameId: string) => {
      if (!gameMap.has(gameId)) gameMap.set(gameId, { h:0, hr:0, rbi:0, r:0, k:0, bb:0, sb:0 });
      return gameMap.get(gameId)!;
  };

  // Process Live
  liveRecords.forEach(pa => {
    // Special handling for Runner Events (SB/CS)
    if (['XI', 'WP', 'BK'].includes(pa.result)) {
        if (pa.result === 'XI') {
            if (pa.isSteal) {
                t.sb++;
                const gs = getGameStats(pa.gameId);
                gs.sb++;
            } else {
                t.cs++; // Correctly count Caught Stealing
            }
        }
        return; // Don't count as PA or anything else
    }

    t.rbi += pa.rbi;
    t.pa++; 
    
    // Collect spray data
    if (pa.coordX !== undefined && pa.coordY !== undefined) {
        t.spray_data.push({ x: pa.coordX, y: pa.coordY, result: pa.result });
    }
    
    const gs = getGameStats(pa.gameId);
    gs.rbi += pa.rbi;

    let isAB = false; let isHit = false; let isOnBase = false; let bases = 0;

    // Direction Logic
    if (pa.result !== 'SO' && pa.result !== 'BB' && pa.result !== 'HBP' && pa.result !== 'SAC') {
        if ([5,6,7].includes(pa.direction)) t.dir_left++;
        else if ([1,2,8].includes(pa.direction)) t.dir_center++;
        else if ([3,4,9].includes(pa.direction)) t.dir_right++;
    }

    switch (pa.result as any) {
      case '1B': t.h++; t.ab++; isHit=true; isAB=true; isOnBase=true; bases=1; gs.h++; break;
      case '2B': t.h++; t.double++; t.ab++; isHit=true; isAB=true; isOnBase=true; bases=2; gs.h++; break;
      case '3B': t.h++; t.triple++; t.ab++; isHit=true; isAB=true; isOnBase=true; bases=3; gs.h++; break;
      case 'HR': t.h++; t.hr++; t.ab++; isHit=true; isAB=true; isOnBase=true; bases=4; gs.h++; gs.hr++; break;
      case 'BB': t.bb++; gs.bb++; isOnBase=true; break;
      case 'IBB': t.bb++; t.ibb++; gs.bb++; isOnBase=true; break;
      case 'HBP': t.hbp++; isOnBase=true; break;
      case 'SO': t.so++; t.ab++; isAB=true; gs.k++; break;
      case 'GO': case 'FO': case 'ROE': case 'FC': t.ab++; isAB=true; break;
      case 'GIDP': t.ab++; t.gidp++; isAB=true; break;
      case 'SF': t.sf++; break;
      case 'SAC': t.sac++; break;
    }

    if ((pa.runner2 || pa.runner3) && isAB) {
      t.risp_ab++;
      if (isHit) t.risp_h++;
    }

    // Split Stats Logic
    if (pa.vsHand === 'R') {
        if (isAB) t.ab_vs_r++;
        if (isHit) t.h_vs_r++;
        if (pa.result === 'HR') t.hr_vs_r++;
        
        if (isAB || pa.result === 'SF') obp_denom_vs_r++; // AB + SF
        if (pa.result === 'BB' || pa.result === 'IBB' || pa.result === 'HBP') { obp_denom_vs_r++; obp_num_vs_r++; }
        if (isHit) obp_num_vs_r++;
        tb_vs_r += bases;
    } else if (pa.vsHand === 'L') {
        if (isAB) t.ab_vs_l++;
        if (isHit) t.h_vs_l++;
        if (pa.result === 'HR') t.hr_vs_l++;

        if (isAB || pa.result === 'SF') obp_denom_vs_l++;
        if (pa.result === 'BB' || pa.result === 'IBB' || pa.result === 'HBP') { obp_denom_vs_l++; obp_num_vs_l++; }
        if (isHit) obp_num_vs_l++;
        tb_vs_l += bases;
    }
  });

  // Process Batch
  batchRecords.forEach(r => {
    t.ab += r.ab; t.h += r.h; t.double += r.double; t.triple += r.triple; t.hr += r.hr;
    t.bb += r.bb; t.ibb += (r.ibb || 0); t.hbp += r.hbp;
    t.sf += r.sf; t.sac += r.sac; t.so += r.k;
    t.r += r.r; t.rbi += r.rbi; t.sb += r.sb; t.cs += r.cs; t.gidp += r.gidp;
    t.pa += (r.ab + r.bb + r.hbp + r.sf + r.sac);

    const gid = r.date + r.opponent; 
    const gs = getGameStats(gid);
    gs.h += r.h;
    gs.hr += r.hr;
    gs.rbi += r.rbi;
    gs.r += r.r;
    gs.k += r.k;
    gs.bb += r.bb;
    gs.sb += r.sb;
  });

  // --- 2. Game High Calculations ---
  gameMap.forEach(stats => {
      if (stats.h >= 2) t.multi_hit++;
      if (stats.h >= 3) t.mouda++;
      if (stats.h >= 4) t.katame++;
      if (stats.hr >= 2) t.multi_hr++;
      if (stats.rbi >= 3) t.multi_rbi++;
      if (stats.r >= 2) t.multi_r++;
      if (stats.k >= 3) t.multi_k++;
      if (stats.bb >= 2) t.multi_bb++;
      if (stats.sb >= 2) t.multi_sb++;
  });
  
  t.hr_win_loss = `---`; 

  // --- 3. Basic Formulae ---
  const singles = t.h - (t.double + t.triple + t.hr);
  const totalBases = singles + (2 * t.double) + (3 * t.triple) + (4 * t.hr);
  
  t.avg = t.ab > 0 ? t.h / t.ab : 0;
  const obpDenom = t.ab + t.bb + t.hbp + t.sf;
  t.obp = obpDenom > 0 ? (t.h + t.bb + t.hbp) / obpDenom : 0;
  t.slg = t.ab > 0 ? totalBases / t.ab : 0;
  t.ops = t.obp + t.slg;

  // Split Results
  t.avg_vs_r = t.ab_vs_r > 0 ? t.h_vs_r / t.ab_vs_r : 0;
  const obp_vs_r = obp_denom_vs_r > 0 ? obp_num_vs_r / obp_denom_vs_r : 0;
  const slg_vs_r = t.ab_vs_r > 0 ? tb_vs_r / t.ab_vs_r : 0;
  t.ops_vs_r = obp_vs_r + slg_vs_r;

  t.avg_vs_l = t.ab_vs_l > 0 ? t.h_vs_l / t.ab_vs_l : 0;
  const obp_vs_l = obp_denom_vs_l > 0 ? obp_num_vs_l / obp_denom_vs_l : 0;
  const slg_vs_l = t.ab_vs_l > 0 ? tb_vs_l / t.ab_vs_l : 0;
  t.ops_vs_l = obp_vs_l + slg_vs_l;


  // --- 4. Advanced Metrics ---
  t.noi = (t.obp + (t.slg / 3)) * 1000;
  t.gpa = ((t.obp * 1.8) + t.slg) / 4;
  t.iso_p = t.slg - t.avg;
  t.iso_d = t.obp - t.avg;

  // RC (Runs Created) - Basic RC
  const rcA = t.h + t.bb + t.hbp - t.cs - t.gidp;
  const rcB = totalBases + (0.26 * (t.bb + t.hbp)) + (0.52 * (t.sf + t.sac)) + (0.64 * t.sb);
  const rcC = t.ab + t.bb + t.hbp + t.sf + t.sac; 
  
  if (rcC > 0) {
      t.rc = (rcA * rcB) / rcC;
  }
  
  // Rate Stats (RC27, XR27)
  const totalOuts = t.ab - t.h + t.sac + t.sf + t.cs + t.gidp;
  t.rc27 = totalOuts > 0 ? (t.rc * 27) / totalOuts : (t.rc > 0 ? Infinity : 0);

  // XR
  const xr = (0.50 * singles) + (0.72 * t.double) + (1.04 * t.triple) + (1.44 * t.hr) 
           + (0.34 * (t.bb + t.hbp - t.ibb)) + (0.25 * t.ibb) + (0.18 * t.sb) - (0.32 * t.cs) 
           - (0.09 * (t.ab - t.h - t.so)) - (0.098 * t.so) - (0.37 * t.gidp) + (0.30 * t.sf) + (0.04 * t.sac);
  t.xr = xr; 
  t.xr27 = totalOuts > 0 ? (t.xr * 27) / totalOuts : (t.xr > 0 ? Infinity : 0);

  const babipDenom = t.ab - t.so - t.hr + t.sf;
  t.babip = babipDenom > 0 ? (t.h - t.hr) / babipDenom : 0;
  t.risp_avg = t.risp_ab > 0 ? t.risp_h / t.risp_ab : 0;

  // RCAA, XR+
  if (leagueStats && leagueStats.totalPA > 0) {
      const lgRcPerPa = leagueStats.totalRC / leagueStats.totalPA;
      t.rcaa = t.rc - (lgRcPerPa * t.pa);
      
      const lgXrPerPa = leagueStats.totalXR / leagueStats.totalPA;
      t.xr_plus = t.xr - (lgXrPerPa * t.pa);

      const rpw = 10 * Math.sqrt((leagueStats.totalRuns * 2) / leagueStats.totalInnings);
      if (rpw > 0) {
          t.rcwin = t.rcaa / rpw;
          t.xrwin = t.xr_plus / rpw;
      }
  }

  // Discipline & Power
  t.bb_k = t.so > 0 ? t.bb / t.so : t.bb;
  t.pa_bb = t.bb > 0 ? t.pa / t.bb : 0;
  t.pa_k = t.so > 0 ? t.pa / t.so : 0;
  t.ab_hr = t.hr > 0 ? t.ab / t.hr : 0;

  // SecA: (TB - H + BB + SB - CS) / AB
  if (t.ab > 0) {
      t.sec_a = (totalBases - t.h + t.bb + t.sb - t.cs) / t.ab;
  }

  // TA
  const taDenom = t.ab - t.h + t.cs + t.gidp;
  if (taDenom > 0) {
      t.ta = (totalBases + t.bb + t.hbp + t.sb - t.cs) / taDenom;
  }

  // PS
  if ((t.hr + t.sb) > 0) {
      t.ps = (t.hr * t.sb * 2) / (t.hr + t.sb);
  }

  // TTO
  t.tto = t.hr + t.bb + t.so; 
  t.tto_rate = t.pa > 0 ? t.tto / t.pa : 0;

  return t;
};


// Global Stats Helper for Relative Metrics (RSAA, etc.)
interface LeagueStats {
    totalIP: number;
    totalRuns: number;
    totalER: number;
    avgERA: number;
    avgR_IP: number; // Runs per Inning
    avgRPW: number;
}

export const calculateLeagueStats = (allPitcherRecords: PitcherGameRecord[]): LeagueStats => {
    let runs = 0;
    let er = 0;
    let outs = 0;
    
    allPitcherRecords.forEach(r => {
        // Sanitize ER just in case (Data correction)
        const safeER = Math.min(r.er, r.r);
        runs += r.r;
        er += safeER;
        outs += r.outs;
    });

    const ip = outs / 3;
    const avgERA = ip > 0 ? (er * 9) / ip : 0;
    const avgR_IP = ip > 0 ? runs / ip : 0;
    const rpw = ip > 0 ? 10 * Math.sqrt((runs * 2) / ip) : 10;

    return {
        totalIP: ip,
        totalRuns: runs,
        totalER: er,
        avgERA,
        avgR_IP, 
        avgRPW: rpw
    };
};

export const calculatePitcherStats = (
    records: PitcherGameRecord[], 
    leagueStats?: LeagueStats
): PitcherStats => {
    const t: PitcherStats = {
        playerId: records[0]?.playerId || '',
        name: records[0]?.playerName || '',
        games: records.length,
        wins: 0, losses: 0, saves: 0, holds: 0, win_rate: 0,
        hp: 0, sp: 0, relief_wins: 0, relief_losses: 0,
        
        outs: 0, ipDisplay: '0.0', p_count: 0,
        h: 0, hr: 0, r: 0, er: 0, bb: 0, ibb: 0, hbp: 0, k: 0, wild_pitch: 0,
        
        ab: 0, h2: 0, h3: 0, sac: 0, sf: 0, go: 0, fo: 0,
        run_support_total: 0, support_innings_total: 0,
        
        era: 0, whip: 0, k_rate: 0, bb_rate: 0, k_bb: 0, hr_9: 0, p_ip: 0,
        qs_rate: 0, hqs_rate: 0, sqs_rate: 0,
        baa: 0, babip: 0, oba: 0, slg_allowed: 0, go_ao: 0, run_support_rate: 0,
        
        ipr: 99.00, nhb_rate: 0,
        fip: 0, lob_pct: 0, rsaa: 0, rpw: 0, rswin: 0, pr: 0, kokendo: 0,
        
        consecutive_games: 0, consecutive_days: 0,
        count_100pitches: 0, count_2digit_h: 0, count_2hr: 0, count_2digit_k: 0, count_5bb: 0,
        stop_win_streak_count: 0, stop_loss_streak_count: 0,
        
        ab_vs_r: 0, h_vs_r: 0, k_vs_r: 0, baa_vs_r: 0, ops_allowed_vs_r: 0,
        ab_vs_l: 0, h_vs_l: 0, k_vs_l: 0, baa_vs_l: 0, ops_allowed_vs_l: 0,

        spray_data: []
    };

    let startCount = 0;
    let qsCount = 0;
    let hqsCount = 0;
    let sqsCount = 0;
    let reliefCount = 0;
    let reliefRuns = 0;
    let reliefOuts = 0;
    let nhbCount = 0;

    // Splits
    let obp_num_v_r=0, obp_den_v_r=0, tb_v_r=0;
    let obp_num_v_l=0, obp_den_v_l=0, tb_v_l=0;

    // --- 1. Fetch & Aggregate LIVE Play Logs for this Pitcher ---
    const allPlayRecs = getPitcherPlayRecords();
    const myPlayRecs = allPlayRecs.filter(r => r.playerId === t.playerId);
    
    // Group Live Records by "GameID" (Date + Opponent)
    const liveGames = new Map<string, Partial<PitcherGameRecord>>();

    myPlayRecs.forEach(p => {
        const gid = p.gameId; // date-opponent
        if (!liveGames.has(gid)) {
            liveGames.set(gid, {
                id: gid, date: p.date, opponent: p.opponent, playerId: p.playerId, playerName: p.playerName,
                outs: 0, h: 0, hr: 0, r: 0, er: 0, bb: 0, ibb: 0, hbp: 0, k: 0, 
                ab: 0, h2: 0, h3: 0, sac: 0, sf: 0, go: 0, fo: 0,
                allowed_spray: [],
                isStarter: false, result: null, wild_pitch: 0, p_count: 0,
                run_support: 0, support_innings: 0
            });
        }
        const g = liveGames.get(gid)!;
        
        if (p.isOut) g.outs = (g.outs || 0) + 1;
        
        let isAB = false; let isHit = false; let bases = 0;

        if (['1B','2B','3B','HR'].includes(p.result)) {
            g.h = (g.h || 0) + 1;
            g.ab = (g.ab || 0) + 1;
            isAB = true; isHit = true;
        }
        if (['GO','FO','SO','GIDP','ROE','FC'].includes(p.result)) {
            g.ab = (g.ab || 0) + 1;
            isAB = true;
        }

        if (p.result === '2B') { g.h2 = (g.h2 || 0) + 1; bases=2; }
        else if (p.result === '3B') { g.h3 = (g.h3 || 0) + 1; bases=3; }
        else if (p.result === 'HR') { g.hr = (g.hr || 0) + 1; bases=4; }
        else if (p.result === '1B') { bases=1; }

        if (p.result === 'BB' || p.result === 'IBB') g.bb = (g.bb || 0) + 1;
        if (p.result === 'IBB') g.ibb = (g.ibb || 0) + 1;
        if (p.result === 'HBP') g.hbp = (g.hbp || 0) + 1;
        if (p.result === 'SO') g.k = (g.k || 0) + 1;
        if (p.result === 'SAC') g.sac = (g.sac || 0) + 1;
        if (p.result === 'SF') g.sf = (g.sf || 0) + 1;
        if (p.result === 'GO' || p.result === 'GIDP') g.go = (g.go || 0) + 1;
        if (p.result === 'FO') g.fo = (g.fo || 0) + 1;
        if (p.result === 'WP') g.wild_pitch = (g.wild_pitch || 0) + 1;

        g.r = (g.r || 0) + (p.runScored || 0);
        g.er = (g.er || 0) + (p.earnedRun || 0);
        
        if (p.coordX !== undefined && p.coordY !== undefined) {
             g.allowed_spray = [...(g.allowed_spray || []), { x: p.coordX, y: p.coordY, result: p.result }];
        }

        // Split Stats Aggregation
        if (p.vsHand === 'R') {
            if(isAB) t.ab_vs_r++;
            if(isHit) t.h_vs_r++;
            if(p.result === 'SO') t.k_vs_r++;
            
            if(isAB || p.result==='SF') obp_den_v_r++;
            if(['BB','IBB','HBP'].includes(p.result)) { obp_den_v_r++; obp_num_v_r++; }
            if(isHit) obp_num_v_r++;
            tb_v_r += bases;
        } else if (p.vsHand === 'L') {
            if(isAB) t.ab_vs_l++;
            if(isHit) t.h_vs_l++;
            if(p.result === 'SO') t.k_vs_l++;

            if(isAB || p.result==='SF') obp_den_v_l++;
            if(['BB','IBB','HBP'].includes(p.result)) { obp_den_v_l++; obp_num_v_l++; }
            if(isHit) obp_num_v_l++;
            tb_v_l += bases;
        }
    });

    const combinedRecords = [...records, ...Array.from(liveGames.values()) as PitcherGameRecord[]];
    t.games = new Set(combinedRecords.map(r => r.date + r.opponent)).size;
    const sortedRecords = combinedRecords.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedRecords.forEach((r) => {
        // Counting Stats
        if (r.result === 'W') t.wins++;
        if (r.result === 'L') t.losses++;
        if (r.result === 'SV') t.saves++;
        if (r.result === 'HLD') t.holds++;
        
        if (!r.isStarter && r.result === 'W') t.relief_wins++;
        if (!r.isStarter && r.result === 'L') t.relief_losses++;

        t.outs += r.outs;
        t.h += r.h;
        t.hr += r.hr;
        t.r += r.r;
        
        // FIX: Sanitize ER. ER cannot be > R.
        const safeER = Math.min(r.er, r.r);
        t.er += safeER;
        
        t.bb += r.bb;
        t.ibb += (r.ibb || 0);
        t.hbp += r.hbp;
        t.k += r.k;
        t.wild_pitch += (r.wild_pitch || 0);
        t.p_count += (r.p_count || 0);
        
        t.ab += (r.ab || 0);
        t.h2 += (r.h2 || 0);
        t.h3 += (r.h3 || 0);
        t.sac += (r.sac || 0);
        t.sf += (r.sf || 0);
        t.go += (r.go || 0);
        t.fo += (r.fo || 0);
        
        if (r.allowed_spray) {
            t.spray_data.push(...r.allowed_spray);
        }
        
        if (r.isStarter) {
            startCount++;
            if (r.outs >= 18 && safeER <= 3) qsCount++;
            if (r.outs >= 21 && safeER <= 2) hqsCount++;
            if (r.outs >= 21 && safeER <= 3) sqsCount++;
            
            t.run_support_total += (r.run_support || 0);
            t.support_innings_total += (r.support_innings || 0);
        } else {
            reliefCount++;
            reliefRuns += r.r;
            reliefOuts += r.outs;
            if (r.h === 0 && r.bb === 0 && r.hbp === 0) nhbCount++;
        }

        if (r.stop_win_streak) t.stop_win_streak_count++;
        if (r.stop_loss_streak) t.stop_loss_streak_count++;

        if ((r.p_count || 0) >= 100) t.count_100pitches++;
        if (r.h >= 10) t.count_2digit_h++;
        if (r.hr >= 2) t.count_2hr++;
        if (r.k >= 10) t.count_2digit_k++;
        if ((r.bb + r.hbp) >= 5) t.count_5bb++;
    });

    // --- Streak Calculation (Last N games/days) ---
    if (sortedRecords.length > 0) {
        let currentStreak = 1;
        let lastDate = new Date(sortedRecords[sortedRecords.length - 1].date);
        
        for (let i = sortedRecords.length - 2; i >= 0; i--) {
            const d = new Date(sortedRecords[i].date);
            const diffTime = Math.abs(lastDate.getTime() - d.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays <= 1) { 
                currentStreak++;
                lastDate = d;
            } else {
                break;
            }
        }
        t.consecutive_days = currentStreak > 1 ? currentStreak : 0;
    }

    // --- Calculations ---
    const innings = t.outs / 3;
    t.ipDisplay = `${Math.floor(t.outs / 3)}${t.outs % 3 > 0 ? '.' + (t.outs % 3) : ''}`;
    
    t.hp = t.holds + t.relief_wins;
    t.sp = t.saves + t.relief_wins;
    
    const decisions = t.wins + t.losses;
    t.win_rate = decisions > 0 ? t.wins / decisions : 0;

    // Rate Stats
    if (innings > 0) {
        t.era = (t.er * 9) / innings;
        t.whip = (t.bb + t.h) / innings;
        t.k_rate = (t.k * 9) / innings;
        t.bb_rate = (t.bb * 9) / innings;
        t.hr_9 = (t.hr * 9) / innings;
        t.p_ip = t.p_count / innings;
    }
    t.k_bb = t.bb > 0 ? t.k / t.bb : t.k;

    // Split Calc
    t.baa_vs_r = t.ab_vs_r > 0 ? t.h_vs_r / t.ab_vs_r : 0;
    const obp_allowed_v_r = obp_den_v_r > 0 ? obp_num_v_r / obp_den_v_r : 0;
    const slg_allowed_v_r = t.ab_vs_r > 0 ? tb_v_r / t.ab_vs_r : 0;
    t.ops_allowed_vs_r = obp_allowed_v_r + slg_allowed_v_r;

    t.baa_vs_l = t.ab_vs_l > 0 ? t.h_vs_l / t.ab_vs_l : 0;
    const obp_allowed_v_l = obp_den_v_l > 0 ? obp_num_v_l / obp_den_v_l : 0;
    const slg_allowed_v_l = t.ab_vs_l > 0 ? tb_v_l / t.ab_vs_l : 0;
    t.ops_allowed_vs_l = obp_allowed_v_l + slg_allowed_v_l;


    // Advanced Rates
    if (startCount > 0) {
        t.qs_rate = qsCount / startCount;
        t.hqs_rate = hqsCount / startCount;
        t.sqs_rate = sqsCount / startCount;
    }
    if (t.ab > 0) {
        t.baa = t.h / t.ab;
        const singles = t.h - t.h2 - t.h3 - t.hr;
        const tb = singles + (2 * t.h2) + (3 * t.h3) + (4 * t.hr);
        t.slg_allowed = tb / t.ab;
    }
    
    const babipDenom = t.ab - t.k - t.hr + t.sf;
    t.babip = babipDenom > 0 ? (t.h - t.hr) / babipDenom : 0;

    const obaDenom = t.ab + t.bb + t.hbp + t.sf;
    t.oba = obaDenom > 0 ? (t.h + t.bb + t.hbp) / obaDenom : 0;

    t.go_ao = t.fo > 0 ? t.go / t.fo : 0;

    t.run_support_rate = t.support_innings_total > 0 ? (t.run_support_total * 9) / t.support_innings_total : 0;

    if (reliefCount > 0) {
        const rip = reliefOuts / 3;
        t.ipr = reliefRuns > 0 ? rip / reliefRuns : 99.00;
        t.nhb_rate = nhbCount / reliefCount;
    }

    if (innings > 0) {
        const cFip = 3.10;
        t.fip = ((13 * t.hr + 3 * (t.bb + t.hbp - t.ibb) - 2 * t.k) / innings) + cFip;
    }

    const runners = t.h + t.bb + t.hbp;
    const lobDenom = runners - (1.4 * t.hr);
    t.lob_pct = lobDenom > 0 ? (runners - t.r) / lobDenom : 0;

    if (leagueStats && innings > 0) {
        const lAvgR = leagueStats.avgR_IP; // Runs per IP
        const lAvgEra = leagueStats.avgERA; // ERA
        const rpw = leagueStats.avgRPW;
        t.rpw = rpw;

        const leagueR9 = lAvgR * 9;
        const myR9 = (t.r * 9) / innings;
        t.rsaa = ((leagueR9 - myR9) * innings) / 9;

        t.pr = ((lAvgEra - t.era) * innings) / 9;
        t.rswin = rpw > 0 ? t.rsaa / rpw : 0;
    }

    t.kokendo = t.outs + (t.wins + t.holds + t.saves) * 10;

    return t;
};

export const formatStat = (val: number, decimals: number = 3): string => {
  if (isNaN(val) || !isFinite(val)) return "---";
  const fixed = val.toFixed(decimals);
  if (Math.abs(val) < 1) {
    return fixed.replace(/^0+/, '').replace(/^-0+/, '-');
  }
  return fixed;
};
