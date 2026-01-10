import { PlateAppearance, GameBatchRecord, BatterStats, PitcherGameRecord, PitcherStats, PositionNum } from '../types';

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
    // Approx league innings from PA? Hard to say without pitcher data here.
    // We will assume approx 38 PA per 9 innings. Innings = PA / 4.2 approx?
    // Better to use a standard constant or just simple ratio if Pitcher stats not passed.
    // Let's assume RPW logic uses Pitcher data usually. If not available, we assume average game.
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
    
    spray_data: []
  };

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
    t.rbi += pa.rbi;
    t.pa++; 
    
    // Collect spray data if available
    if (pa.coordX !== undefined && pa.coordY !== undefined) {
        t.spray_data.push({ x: pa.coordX, y: pa.coordY, result: pa.result });
    }
    
    const gs = getGameStats(pa.gameId);
    gs.rbi += pa.rbi;

    let isAB = false; let isHit = false;

    // Direction Logic
    // Left: 5(3B), 6(SS), 7(LF)
    // Center: 1(P), 2(C), 8(CF)
    // Right: 3(1B), 4(2B), 9(RF)
    if (pa.result !== 'SO' && pa.result !== 'BB' && pa.result !== 'HBP' && pa.result !== 'SAC') {
        if ([5,6,7].includes(pa.direction)) t.dir_left++;
        else if ([1,2,8].includes(pa.direction)) t.dir_center++;
        else if ([3,4,9].includes(pa.direction)) t.dir_right++;
    }

    switch (pa.result) {
      case '1B': t.h++; t.ab++; isHit=true; isAB=true; gs.h++; break;
      case '2B': t.h++; t.double++; t.ab++; isHit=true; isAB=true; gs.h++; break;
      case '3B': t.h++; t.triple++; t.ab++; isHit=true; isAB=true; gs.h++; break;
      case 'HR': t.h++; t.hr++; t.ab++; isHit=true; isAB=true; gs.h++; gs.hr++; break;
      case 'BB': t.bb++; gs.bb++; break;
      case 'IBB': t.bb++; t.ibb++; gs.bb++; break;
      case 'HBP': t.hbp++; break;
      case 'SO': t.so++; t.ab++; isAB=true; gs.k++; break;
      case 'GO': case 'FO': case 'ROE': case 'FC': t.ab++; isAB=true; break;
      case 'SF': t.sf++; break;
      case 'SAC': t.sac++; break;
      case 'XI': t.pa--; break;
    }
    
    // Note: 'r' (Run Scored) is not explicitly in PlateAppearance result (only RBI). 
    // Usually input form should have "Scored?" checkbox, but for MVP we might miss R from live unless inferred.
    // For now we assume R is manual or batch only, OR we add it to input. 
    // Prompt "Input is minimal". Let's assume R comes from Batch mostly or we need to add it.
    // *Correction*: Input form doesn't have "Scored". So R will be 0 for Live records unless we add it.
    // We will rely on Batch for accurate R counts or simple Live R count if added later.

    if ((pa.runner2 || pa.runner3) && isAB) {
      t.risp_ab++;
      if (isHit) t.risp_h++;
    }
  });

  // Process Batch
  batchRecords.forEach(r => {
    t.ab += r.ab; t.h += r.h; t.double += r.double; t.triple += r.triple; t.hr += r.hr;
    t.bb += r.bb; t.ibb += (r.ibb || 0); t.hbp += r.hbp;
    t.sf += r.sf; t.sac += r.sac; t.so += r.k;
    t.r += r.r; t.rbi += r.rbi; t.sb += r.sb; t.cs += r.cs; t.gidp += r.gidp;
    t.pa += (r.ab + r.bb + r.hbp + r.sf + r.sac);

    const gid = r.date + r.opponent; // Simple ID
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
      if (stats.bb >= 2) t.multi_bb++; // Includes IBB/HBP? Usually just BB.
      if (stats.sb >= 2) t.multi_sb++;
  });
  
  // HR Win-Loss (Placeholder: needs Game Result data linked to stats)
  // Since we don't track Game Win/Loss in Batter input, we leave this empty or mock.
  t.hr_win_loss = `---`; 

  // --- 3. Basic Formulae ---
  const singles = t.h - (t.double + t.triple + t.hr);
  const totalBases = singles + (2 * t.double) + (3 * t.triple) + (4 * t.hr);
  
  t.avg = t.ab > 0 ? t.h / t.ab : 0;
  const obpDenom = t.ab + t.bb + t.hbp + t.sf;
  t.obp = obpDenom > 0 ? (t.h + t.bb + t.hbp) / obpDenom : 0;
  t.slg = t.ab > 0 ? totalBases / t.ab : 0;
  t.ops = t.obp + t.slg;

  // --- 4. Advanced Metrics ---
  t.noi = (t.obp + (t.slg / 3)) * 1000;
  t.gpa = ((t.obp * 1.8) + t.slg) / 4;
  t.iso_p = t.slg - t.avg;
  t.iso_d = t.obp - t.avg;

  // RC
  const rcA = t.h + t.bb + t.hbp - t.cs - t.gidp;
  const rcB = totalBases + (0.26 * (t.bb + t.hbp)) + (0.53 * (t.sf + t.sac)) + (0.64 * t.sb) - (0.03 * t.so);
  const rcC = t.ab + t.bb + t.hbp + t.sf + t.sac; 
  if (rcC > 0) t.rc = (((rcA + 2.4 * rcB) * (rcB + 3 * rcC)) / (9 * rcC)) - (0.9 * rcC);
  
  const totalOuts = t.ab - t.h + t.sac + t.sf + t.cs + t.gidp;
  if (totalOuts > 0) t.rc27 = (t.rc * 27) / totalOuts;

  // XR
  const xr = (0.50 * singles) + (0.72 * t.double) + (1.04 * t.triple) + (1.44 * t.hr) 
           + (0.34 * (t.bb + t.hbp - t.ibb)) + (0.25 * t.ibb) + (0.18 * t.sb) - (0.32 * t.cs) 
           - (0.09 * (t.ab - t.h - t.so)) - (0.098 * t.so) - (0.37 * t.gidp) + (0.30 * t.sf) + (0.04 * t.sac);
  t.xr = xr;
  if (totalOuts > 0) t.xr27 = (t.xr * 27) / totalOuts;

  const babipDenom = t.ab - t.so - t.hr + t.sf;
  t.babip = babipDenom > 0 ? (t.h - t.hr) / babipDenom : 0;
  t.risp_avg = t.risp_ab > 0 ? t.risp_h / t.risp_ab : 0;

  // RCAA, XR+
  if (leagueStats && leagueStats.totalPA > 0) {
      const lgRcPerPa = leagueStats.totalRC / leagueStats.totalPA;
      t.rcaa = t.rc - (lgRcPerPa * t.pa);
      
      const lgXrPerPa = leagueStats.totalXR / leagueStats.totalPA;
      t.xr_plus = t.xr - (lgXrPerPa * t.pa);

      // RPW (Run Per Win) - Need League Pitching Stats ideally.
      // RPW = 10 * sqrt((LgRuns + LgRunsAllowed)/LgIP).
      // If we don't have LgPitching, assume LgRuns ~ LgRunsAllowed.
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

  // SecA = (TB - H + BB + SB - CS) / AB
  if (t.ab > 0) {
      t.sec_a = (totalBases - t.h + t.bb + t.sb - t.cs) / t.ab;
  }

  // TA = (TB + BB + HBP + SB - CS) / (AB - H + CS + GIDP)
  const taDenom = t.ab - t.h + t.cs + t.gidp;
  if (taDenom > 0) {
      t.ta = (totalBases + t.bb + t.hbp + t.sb - t.cs) / taDenom;
  }

  // PS = (HR * SB * 2) / (HR + SB)
  if ((t.hr + t.sb) > 0) {
      t.ps = (t.hr * t.sb * 2) / (t.hr + t.sb);
  }

  // TTO
  t.tto = t.hr + t.bb + t.so; // Note: TTO usually uses BB (not HBP)
  t.tto_rate = t.pa > 0 ? t.tto / t.pa : 0;

  return t;
};

// ... (Pitcher Code remains, reused from previous block) ...
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
        runs += r.r;
        er += r.er;
        outs += r.outs;
    });

    const ip = outs / 3;
    const avgERA = ip > 0 ? (er * 9) / ip : 0;
    const avgR_IP = ip > 0 ? runs / ip : 0;
    
    // RPW = 10 * sqrt((Runs + Runs)/IP) roughly. Usually (LeagueRuns*2/IP) assuming avg team
    // Formula Prompt: RPW = 10 * sqrt[(リーグ得点+リーグ失点)/リーグ投球回]
    // Since we only have Pitching records (Runs Allowed), we assume LeagueRuns approx LeagueRunsAllowed
    const rpw = ip > 0 ? 10 * Math.sqrt((runs * 2) / ip) : 10;

    return {
        totalIP: ip,
        totalRuns: runs,
        totalER: er,
        avgERA,
        avgR_IP, // League Mean Runs Allowed per Inning
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

    // Sorting for Streak Calculation
    const sortedRecords = [...records].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedRecords.forEach((r, index) => {
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
        t.er += r.er;
        t.bb += r.bb;
        t.ibb += (r.ibb || 0);
        t.hbp += r.hbp;
        t.k += r.k;
        t.wild_pitch += (r.wild_pitch || 0);
        t.p_count += (r.p_count || 0);
        
        // Detailed
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
            if (r.outs >= 18 && r.er <= 3) qsCount++;
            if (r.outs >= 21 && r.er <= 2) hqsCount++;
            if (r.outs >= 21 && r.er <= 3) sqsCount++;
            
            t.run_support_total += (r.run_support || 0);
            t.support_innings_total += (r.support_innings || 0);
        } else {
            reliefCount++;
            reliefRuns += r.r;
            reliefOuts += r.outs;
            // NHB: No Hits, No BB/HBP (Error allowed)
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

    // Advanced Rates
    if (startCount > 0) {
        t.qs_rate = qsCount / startCount;
        t.hqs_rate = hqsCount / startCount;
        t.sqs_rate = sqsCount / startCount;
    }
    if (t.ab > 0) {
        t.baa = t.h / t.ab;
        
        // SLG Allowed: Need Total Bases.
        // TB = 1B + 2*2B + 3*3B + 4*HR. 1B = H - 2B - 3B - HR
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