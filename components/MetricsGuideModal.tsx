
import React, { useState } from 'react';
import { X, BookOpen, User, Target } from 'lucide-react';

interface MetricsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MetricCategory = 'batter' | 'pitcher';

interface MetricDef {
  label: string;
  name: string;
  formula: string;
  desc: string;
}

const BATTER_METRICS: MetricDef[] = [
  // --- Basic Rates ---
  {
    label: 'OPS', name: 'On-base Plus Slugging',
    formula: '出塁率 + 長打率',
    desc: '打者の総合的な攻撃力。.800超で優秀、1.000超でリーグ最強クラス。'
  },
  {
    label: '得点圏打率', name: 'RISP Average',
    formula: '得点圏(2塁or3塁)に走者がいる時の安打 / 打数',
    desc: 'チャンスでの勝負強さを示す指標。'
  },
  {
    label: 'NOI', name: 'New Offensive Index',
    formula: '(出塁率 + 長打率/3) × 1000',
    desc: '出塁率を長打率の3倍重視した指標。実際の得点相関が高い。450前後が平均的。'
  },
  {
    label: 'GPA', name: 'Gross Production Average',
    formula: '(出塁率×1.8 + 長打率) / 4',
    desc: 'OPSの欠点(出塁率の過小評価)を補正し、打率に近い感覚で評価できるようにしたもの。'
  },
  
  // --- Run Creation (RC/XR) ---
  {
    label: 'RC / RC27', name: 'Runs Created / per 27 Outs',
    formula: '複雑な塁打計算式 / 27アウト換算',
    desc: 'その打者が「何点生み出したか(RC)」と「その打者だけで打線を組んだら1試合何点取れるか(RC27)」。'
  },
  {
    label: 'XR / XR27', name: 'Extrapolated Runs',
    formula: '各プレーの得点価値の総和(1B=0.5点, HR=1.44点...)',
    desc: 'プレーごとの重み付けによる得点貢献度。RCと並ぶ代表的な指標。'
  },
  
  // --- Relative Values ---
  {
    label: 'RCAA', name: 'Runs Created Above Average',
    formula: '個人のRC - (チーム平均RC/打席 × 個人の打席)',
    desc: '「平均的な打者と比べて何点多く稼いだか」。0が平均。'
  },
  {
    label: 'XR+', name: 'XR Above Average',
    formula: '個人のXR - (チーム平均XR/打席 × 個人の打席)',
    desc: 'RCAAのXR版。平均的な打者との得点貢献差。'
  },
  {
    label: 'RCWIN / XRWIN', name: 'Wins Above Average (RC/XR)',
    formula: 'RCAA(またはXR+) / RunPerWin係数',
    desc: '平均的な打者に比べて「何勝分の勝利をもたらしたか」。得点を勝利数に換算した値。'
  },

  // --- Discipline & Power Analysis ---
  {
    label: 'IsoD', name: 'Isolated Discipline',
    formula: '出塁率 - 打率',
    desc: '四死球による出塁能力(選球眼)。0.07～0.08が標準、0.10超で優秀。'
  },
  {
    label: 'IsoP', name: 'Isolated Power',
    formula: '長打率 - 打率',
    desc: '純粋な長打力。0.200を超えるとスラッガータイプ。'
  },
  {
    label: 'BB/K', name: 'Walks per Strikeout',
    formula: '四球 / 三振',
    desc: '三振1つに対する四球の数。選球眼とコンタクト能力のバランス。1.0超で優秀。'
  },
  {
    label: 'PA/BB', name: 'Plate Appearances per Walk',
    formula: '打席 / 四球',
    desc: '何打席に1回四球を選ぶか。数値が「小さい」ほど四球を選びやすい。'
  },
  {
    label: 'PA/K', name: 'Plate Appearances per Strikeout',
    formula: '打席 / 三振',
    desc: '何打席に1回三振するか。数値が「大きい」ほど三振しにくい。'
  },
  {
    label: 'AB/HR', name: 'At Bats per Home Run',
    formula: '打数 / 本塁打',
    desc: '何打数に1本ホームランが出るか。数値が小さいほどHR頻度が高い。'
  },

  // --- Other Advanced ---
  {
    label: 'SecA', name: 'Secondary Average',
    formula: '(塁打-安打+四球+盗塁-盗塁死) / 打数',
    desc: '打率に含まれない「長打・四球・盗塁」による貢献度。'
  },
  {
    label: 'TA', name: 'Total Average',
    formula: '(塁打+四死球+盗塁) / (打数-安打+盗塁死+併殺)',
    desc: '1アウトあたりの塁獲得期待値。攻撃の効率性を示す。'
  },
  {
    label: 'PS', name: 'Power-Speed Number',
    formula: '(2×本塁打×盗塁) / (本塁打+盗塁)',
    desc: '本塁打と盗塁を両立しているかを示す指標。'
  },
  {
    label: 'TTO / TTO率', name: 'Three True Outcomes',
    formula: '(本塁打+四球+三振) / 打席',
    desc: '守備の影響を受けない3つの結果(HR,BB,K)の割合。高いほど「大味」なパワーヒッター傾向。'
  },
  {
    label: 'BABIP', name: 'Batting Avg on Balls In Play',
    formula: '(安打-本塁打) / (打数-三振-本塁打+犠飛)',
    desc: '本塁打を除くインプレー打球が安打になった割合。運や守備の影響を示唆する。通常.300前後に収束する。'
  },

  // --- Game Highlights ---
  {
    label: 'HR勝敗', name: 'W-L in HR Games',
    formula: '本塁打を打った試合の勝敗',
    desc: 'その選手がHRを打った試合のチーム勝敗。「主砲が打てば勝つ」法則の確認用。'
  },
  {
    label: '猛打賞 / 固め打ち', name: '3+ / 4+ Hits',
    formula: '1試合3安打以上 / 4安打以上',
    desc: '固め打ちの回数。'
  },
  {
    label: '3打点超 / 2得点超', name: 'High RBI / Run Games',
    formula: '1試合3打点以上 / 2得点以上',
    desc: '得点に大きく絡んだ試合数。'
  }
];

const PITCHER_METRICS: MetricDef[] = [
  // --- Contribution ---
  {
    label: 'HP', name: 'Hold Points',
    formula: 'ホールド + 救援勝利',
    desc: '中継ぎ投手の貢献度を示す指標。'
  },
  {
    label: 'SP', name: 'Save Points',
    formula: 'セーブ + 救援勝利',
    desc: '抑え投手の貢献度を示す指標。'
  },
  {
    label: '救勝 / 救敗', name: 'Relief Wins / Losses',
    formula: '先発以外の登板での勝敗',
    desc: 'リリーフ登板時についた勝敗数。'
  },
  
  // --- Efficiency & Quality ---
  {
    label: 'P/IP', name: 'Pitches per Inning',
    formula: '投球数 / 投球回',
    desc: '1イニングあたり何球投げたか。15球以下なら省エネ投球、テンポが良いとされる。'
  },
  {
    label: 'QS率', name: 'Quality Start Rate',
    formula: '6回以上自責3以下 / 先発数',
    desc: '先発投手が試合を作った確率。'
  },
  {
    label: 'HQS率', name: 'High Quality Start Rate',
    formula: '7回以上自責2以下 / 先発数',
    desc: 'QSよりハイレベルな、支配的な投球をした確率。'
  },
  {
    label: 'SQS率', name: 'Super Quality Start Rate',
    formula: '7回以上自責3以下 / 先発数',
    desc: 'QS(6回3自責)とHQS(7回2自責)の中間指標。イニングを長く消化し試合を作った確率。'
  },

  // --- Rates (Per 9 Innings) ---
  {
    label: '奪三振率', name: 'K/9',
    formula: '奪三振 × 9 / 投球回',
    desc: '1試合完投した場合にいくつ三振を取れるか。'
  },
  {
    label: '与四球率', name: 'BB/9',
    formula: '与四球 × 9 / 投球回',
    desc: '1試合完投した場合にいくつ四球を出すか。3.00以下なら制球が良い。'
  },
  {
    label: '被本率', name: 'HR/9',
    formula: '被本塁打 × 9 / 投球回',
    desc: '1試合あたり何本HRを打たれるか。'
  },
  {
    label: 'WHIP', name: 'Walks+Hits per Inning',
    formula: '(被安打 + 与四球) / 投球回',
    desc: '1イニングあたり何人の走者(安打+四球)を出すか。1.20未満で優秀。'
  },
  {
    label: 'K/BB', name: 'Strikeout to Walk Ratio',
    formula: '奪三振 / 与四球',
    desc: '四球に対する三振の比率。投手の支配力を示す重要指標。3.5以上で優秀。'
  },

  // --- Advanced ---
  {
    label: 'BABIP', name: 'Batting Avg on Balls In Play',
    formula: '(被安打-被本塁打)/(被打数-奪三振-被本塁打+被犠飛)',
    desc: 'インプレー打球がヒットになった割合。投手の場合、極端に高い/低い数値は「運」や「守備力」の影響を示唆する。'
  },
  {
    label: 'LOB%', name: 'Left On Base %',
    formula: '残塁 / (安打+四死球-本塁打)',
    desc: '出した走者をどれだけ生還させなかったか(粘り強さ)。平均は70%〜72%。'
  },
  {
    label: 'FIP', name: 'Fielding Independent Pitching',
    formula: '被本塁打・四死球・奪三振のみで計算した疑似防御率',
    desc: '守備や運の影響を除外し、投手自身の能力だけを評価した防御率。'
  },
  {
    label: 'RSAA', name: 'Runs Saved Above Average',
    formula: '(チーム平均失点率 - 個人失点率) × 投球回 / 9',
    desc: '平均的な投手と比べて「どれだけ失点を防いだか」。プラスなら平均以上。'
  },
  {
    label: 'PR', name: 'Pitching Runs',
    formula: '(チーム平均防御率 - 個人防御率) × 投球回 / 9',
    desc: 'RSAAの防御率版。平均的な投手に比べて、自責点をどれだけ減らしたか。'
  },
  {
    label: 'KD', name: 'Kokendo (Contribution)',
    formula: 'アウト数 + (勝+S+H)×10',
    desc: '当アプリ独自の貢献度指標。イニング消化と勝利・セーブ・ホールドを総合的に評価。'
  },

  // --- Streaks ---
  {
    label: '連勝/連敗STP', name: 'Streak Stoppers',
    formula: 'チーム連勝/連敗を止めた試合数',
    desc: 'チームの悪い流れ(連敗)を止めた、あるいは良い流れ(連勝)を止めてしまった回数。'
  },
  {
    label: '援護率', name: 'Run Support Rate',
    formula: '援護点 × 9 / 攻撃中の投球回',
    desc: 'その投手が投げている間に、味方が1試合換算で何点取ってくれたか。'
  }
];

export const MetricsGuideModal: React.FC<MetricsGuideModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<MetricCategory>('batter');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-slate-50 rounded-t-xl shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 p-2 rounded-full text-indigo-700">
              <BookOpen size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">指標・用語解説ガイド</h3>
              <p className="text-xs text-slate-500">ダッシュボードに表示される各項目の計算式と意味</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button 
            onClick={() => setTab('batter')}
            className={`flex-1 py-3 font-bold text-sm flex items-center justify-center gap-2 transition ${tab==='batter' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <User size={18}/> 野手指標 (Batter)
          </button>
          <button 
            onClick={() => setTab('pitcher')}
            className={`flex-1 py-3 font-bold text-sm flex items-center justify-center gap-2 transition ${tab==='pitcher' ? 'border-b-2 border-red-600 text-red-600 bg-red-50/50' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <Target size={18}/> 投手指標 (Pitcher)
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 md:p-6 bg-slate-50/30 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(tab === 'batter' ? BATTER_METRICS : PITCHER_METRICS).map((m, idx) => (
              <div key={idx} className="border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                  <div>
                    <h4 className={`text-lg font-extrabold font-mono ${tab==='batter'?'text-blue-700':'text-red-700'}`}>{m.label}</h4>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{m.name}</span>
                  </div>
                </div>
                
                <div className="space-y-3 flex-1">
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">計算式・条件</span>
                    <code className="text-xs font-mono text-slate-700 font-bold break-all leading-tight">
                      {m.formula}
                    </code>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-xs text-yellow-800">
            <strong><span className="text-lg mr-1">💡</span>注意点:</strong><br/>
            <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>一部の相対指標（RCAA, RSAAなど）は、一般的には「リーグ全体の平均」を用いますが、本アプリでは<strong>「現在表示されている（フィルタリングされた）選手たちの平均」</strong>を基準値（ゼロ）として算出しています。</li>
                <li>「連勝STP」「連敗STP」は、チームの連勝/連敗を止めた投手をカウントします。</li>
                <li>計算式において分母が0になる場合、便宜上 0 または --- と表示されます。</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-end rounded-b-xl shrink-0">
          <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700 transition shadow-sm">
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
