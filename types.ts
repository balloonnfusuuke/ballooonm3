
export interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
  type: 'batter' | 'pitcher' | 'two-way';
  teamId?: string; // If undefined, belongs to "My Team". If defined, belongs to that Opponent ID.
}

export interface Opponent {
  id: string;
  name: string;
}

// --- Live Data Types ---
export type ResultType = 
  | '1B' | '2B' | '3B' | 'HR' 
  | 'BB' | 'IBB' | 'HBP' 
  | 'SO' | 'GO' | 'FO' | 'SAC' | 'SF' | 'ROE' | 'FC' | 'XI'
  | 'GIDP' // NEW: Ground into Double Play
  | 'WP' | 'BK'; // Added Pitcher Faults

export type PositionNum = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0;

export interface PlateAppearance {
  id: string;
  gameId: string;
  date: string;
  opponent: string;
  playerId: string;
  playerName: string;
  inning: number;
  isTop: boolean;
  runner1: boolean;
  runner2: boolean;
  runner3: boolean;
  result: ResultType;
  direction: PositionNum;
  rbi: number;
  isSteal: boolean;
  // Scorebook Coordinates (0-100%)
  coordX?: number; 
  coordY?: number;
}

// NEW: Live Pitcher Record (Play-by-Play)
export interface PitcherPlayRecord {
  id: string;
  gameId: string;
  date: string;
  opponent: string;
  playerId: string;
  playerName: string;
  inning: number;
  result: ResultType; // Using same ResultType as batter
  coordX?: number;
  coordY?: number;
  // Stats impact
  isOut: boolean;
  runScored: number; // Runs scored on this play
  earnedRun: number; // ER on this play
}

// --- Batch Data Types ---
export interface GameBatchRecord {
  id: string;
  date: string;
  opponent: string;
  playerId: string;
  playerName: string;
  ab: number; h: number; double: number; triple: number; hr: number;
  bb: number; ibb: number; hbp: number;
  sf: number; sac: number; k: number;
  r: number; rbi: number;
  sb: number; cs: number; gidp: number;
}

// --- Pitcher Data Types ---
export interface PitcherGameRecord {
  id: string;
  date: string;
  opponent: string;
  playerId: string;
  playerName: string;
  
  isStarter: boolean; 
  result: 'W' | 'L' | 'SV' | 'HLD' | null;
  
  outs: number; 

  h: number; hr: number; r: number; er: number; 
  bb: number; ibb: number; hbp: number; k: number; 
  wild_pitch: number; p_count: number;

  ab: number; h2: number; h3: number;
  sac: number; sf: number; go: number; fo: number;
  
  run_support: number; 
  support_innings: number; 
  
  stop_win_streak: boolean; 
  stop_loss_streak: boolean; 

  // Spray Chart Data for Pitchers (Hits allowed locations)
  allowed_spray?: Array<{x: number, y: number, result: string}>;
}

// --- Aggregated Stats ---
export interface BatterStats {
  playerId: string;
  name: string;
  games: number;
  
  // Basic Counting
  pa: number; ab: number; h: number; 
  double: number; triple: number; hr: number;
  bb: number; ibb: number; hbp: number;
  so: number; sf: number; sac: number;
  r: number; rbi: number;
  sb: number; cs: number; gidp: number;
  
  // Basic Rates
  avg: number; obp: number; slg: number; ops: number;
  
  // Sabermetrics / Advanced
  noi: number; gpa: number; 
  rc: number; rc27: number; 
  xr: number; xr27: number;
  babip: number; iso_p: number; iso_d: number;
  risp_avg: number; risp_ab: number; risp_h: number;

  // New Metrics (Prompt Request)
  rcaa: number; xr_plus: number;
  rcwin: number; xrwin: number;
  bb_k: number; pa_bb: number; pa_k: number; ab_hr: number;
  sec_a: number; ta: number; ps: number;
  tto: number; tto_rate: number;
  
  // Directions (Left/Center/Right)
  dir_left: number; dir_center: number; dir_right: number;
  
  // Game Highs / Counts
  multi_hit: number; // 2+ H
  mouda: number; // 3+ H
  katame: number; // 4+ H
  multi_hr: number; // 2+ HR
  multi_rbi: number; // 3+ RBI (Prompt: 3打点超)
  multi_r: number; // 2+ R
  multi_k: number; // 3+ K
  multi_bb: number; // 2+ BB
  multi_sb: number; // 2+ SB
  multi_error: number; // 2+ E (Note: Input doesn't track defensive errors per game perfectly yet, but placeholder)
  hr_win_loss: string; // "W-L-D" in games with HR

  // Spray Chart Data (Array of coordinates)
  spray_data: Array<{x: number, y: number, result: ResultType}>;
}

export interface PitcherStats {
  playerId: string;
  name: string;
  games: number;
  
  wins: number; losses: number; saves: number; holds: number;
  win_rate: number;
  hp: number; sp: number; relief_wins: number; relief_losses: number;
  
  outs: number; ipDisplay: string; p_count: number;
  
  h: number; hr: number; r: number; er: number;
  bb: number; ibb: number; hbp: number; k: number;
  wild_pitch: number;
  
  ab: number; h2: number; h3: number; sac: number; sf: number;
  go: number; fo: number;
  run_support_total: number; support_innings_total: number;

  era: number; whip: number; k_rate: number; bb_rate: number; hr_9: number;
  k_bb: number; p_ip: number;
  
  qs_rate: number; hqs_rate: number; sqs_rate: number;
  baa: number; babip: number; oba: number; slg_allowed: number; go_ao: number;
  run_support_rate: number;
  
  ipr: number; nhb_rate: number;
  fip: number; lob_pct: number;
  rsaa: number; rpw: number; rswin: number; pr: number; kokendo: number;
  
  consecutive_games: number; consecutive_days: number;
  count_100pitches: number; count_2digit_h: number; count_2hr: number; count_2digit_k: number; count_5bb: number;
  stop_win_streak_count: number; stop_loss_streak_count: number;

  // Spray Chart Data (Array of coordinates)
  spray_data: Array<{x: number, y: number, result: string}>;
}

export enum TabView {
  INPUT = 'INPUT',
  DASHBOARD = 'DASHBOARD',
  DATA = 'DATA',
  SETTINGS = 'SETTINGS',
}
