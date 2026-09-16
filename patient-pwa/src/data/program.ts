/**
 * リハビリプログラムの定義。
 *
 * 想定: 週 3 回・1 回 30〜50 分の structured exercise（セッション）＋ 毎日のウォーキング。
 * セッションはブロック（ウォームアップ → 筋力 → 有酸素 → クールダウン）の順に進める。
 * セッション前の体調確認で黄信号なら mildBlocks（5〜10 分の軽いメニュー）、赤信号なら中止。
 * 種目・回数・時間は **リハビリテーション科と協議のうえ確定する**。以下は構成を示すための仮の内容。
 * 動画ができたら exercises.ts の videoUrl に入れる。
 */
export interface Block {
  id: 'warmup' | 'strength' | 'aerobic' | 'cooldown';
  name: string;
  minutes: number;           // 目安
  items: { code: string; target: string }[];
}

export interface Program {
  id: number;
  name: string;
  sessionsPerWeek: number;
  sessionMinutes: string;    // 表示用「30〜50 分」
  suggestedDays: number[];   // 0=日 … 6=土。あくまで目安で、どの曜日に行っても週の回数に数える
  walking: { dailyMinutes: number; note: string };
  blocks: Block[];
  /** 黄信号のときの軽いメニュー（5〜10 分） */
  mildBlocks: Block[];
}

export const SESSIONS_PER_WEEK = 3;

export const PROGRAMS: Program[] = [
  {
    id: 1,
    name: '標準',
    sessionsPerWeek: SESSIONS_PER_WEEK,
    sessionMinutes: '40〜50 分',
    suggestedDays: [1, 3, 5],
    walking: { dailyMinutes: 30, note: '「ややきつい」と感じる速さで。分けて歩いても構いません' },
    blocks: [
      { id: 'warmup', name: 'ウォームアップ', minutes: 5, items: [
        { code: 'seated_march', target: '2 分' },
        { code: 'stretch', target: '各 20 秒' }
      ] },
      { id: 'strength', name: '筋力トレーニング', minutes: 25, items: [
        { code: 'squat', target: '10 回 × 3 セット' },
        { code: 'chair_stand', target: '10 回 × 3 セット' },
        { code: 'heel_raise', target: '15 回 × 3 セット' },
        { code: 'wall_pushup', target: '10 回 × 3 セット' },
        { code: 'band_row', target: '10 回 × 3 セット' },
        { code: 'balance', target: '左右 10 秒 × 3' }
      ] },
      { id: 'aerobic', name: '有酸素運動', minutes: 10, items: [
        { code: 'step', target: '10 分（足踏み・踏み台・その場歩き）' }
      ] },
      { id: 'cooldown', name: 'クールダウン', minutes: 5, items: [
        { code: 'breathing', target: '10 回' },
        { code: 'stretch', target: '各 20 秒' }
      ] }
    ],
    mildBlocks: [
      { id: 'warmup', name: '軽く体を動かす', minutes: 3, items: [
        { code: 'seated_march', target: '2 分（座ったままで可）' },
        { code: 'stretch', target: '各 15 秒' }
      ] },
      { id: 'strength', name: '軽い筋力', minutes: 4, items: [
        { code: 'chair_stand', target: '5 回 × 1 セット（手を使って可）' },
        { code: 'heel_raise', target: '10 回 × 1 セット' }
      ] },
      { id: 'cooldown', name: '呼吸とストレッチ', minutes: 3, items: [
        { code: 'breathing', target: '10 回' },
        { code: 'stretch', target: '各 15 秒' }
      ] }
    ]
  },
  {
    id: 2,
    name: '低体力',
    sessionsPerWeek: SESSIONS_PER_WEEK,
    sessionMinutes: '30 分',
    suggestedDays: [1, 3, 5],
    walking: { dailyMinutes: 15, note: '5 分ずつに分けても構いません。無理のない速さで' },
    blocks: [
      { id: 'warmup', name: 'ウォームアップ', minutes: 5, items: [
        { code: 'seated_march', target: '2 分' },
        { code: 'stretch', target: '各 20 秒' }
      ] },
      { id: 'strength', name: '筋力トレーニング', minutes: 15, items: [
        { code: 'chair_stand', target: '5 回 × 2 セット' },
        { code: 'heel_raise', target: '10 回 × 2 セット' },
        { code: 'wall_pushup', target: '8 回 × 2 セット' },
        { code: 'band_row', target: '10 回 × 2 セット' }
      ] },
      { id: 'aerobic', name: '有酸素運動', minutes: 5, items: [
        { code: 'seated_march', target: '5 分（座ったままでも可）' }
      ] },
      { id: 'cooldown', name: 'クールダウン', minutes: 5, items: [
        { code: 'breathing', target: '10 回' },
        { code: 'stretch', target: '各 20 秒' }
      ] }
    ],
    mildBlocks: [
      { id: 'warmup', name: '軽く体を動かす', minutes: 3, items: [
        { code: 'seated_march', target: '2 分（座ったままで可）' },
        { code: 'stretch', target: '各 15 秒' }
      ] },
      { id: 'strength', name: '軽い筋力', minutes: 4, items: [
        { code: 'chair_stand', target: '5 回 × 1 セット（手を使って可）' },
        { code: 'heel_raise', target: '10 回 × 1 セット' }
      ] },
      { id: 'cooldown', name: '呼吸とストレッチ', minutes: 3, items: [
        { code: 'breathing', target: '10 回' },
        { code: 'stretch', target: '各 15 秒' }
      ] }
    ]
  },
  {
    id: 3,
    name: '神経障害あり',
    sessionsPerWeek: SESSIONS_PER_WEEK,
    sessionMinutes: '30〜40 分',
    suggestedDays: [1, 3, 5],
    walking: { dailyMinutes: 20, note: '屋内や手すりのそばで。しびれが強い日は座って足踏みに置き換えて構いません' },
    blocks: [
      { id: 'warmup', name: 'ウォームアップ', minutes: 5, items: [
        { code: 'seated_march', target: '2 分' },
        { code: 'stretch', target: '各 20 秒' }
      ] },
      { id: 'strength', name: '筋力トレーニング', minutes: 20, items: [
        { code: 'chair_stand', target: '10 回 × 3 セット' },
        { code: 'heel_raise', target: '10 回 × 3 セット（両手でつかまる）' },
        { code: 'wall_pushup', target: '10 回 × 3 セット' },
        { code: 'band_row', target: '10 回 × 3 セット' }
      ] },
      { id: 'aerobic', name: '有酸素運動', minutes: 8, items: [
        { code: 'seated_march', target: '8 分（座ったまま）' }
      ] },
      { id: 'cooldown', name: 'クールダウン', minutes: 5, items: [
        { code: 'breathing', target: '10 回' },
        { code: 'stretch', target: '各 20 秒' }
      ] }
    ],
    mildBlocks: [
      { id: 'warmup', name: '軽く体を動かす', minutes: 3, items: [
        { code: 'seated_march', target: '2 分（座ったままで可）' },
        { code: 'stretch', target: '各 15 秒' }
      ] },
      { id: 'strength', name: '軽い筋力', minutes: 4, items: [
        { code: 'chair_stand', target: '5 回 × 1 セット（手を使って可）' },
        { code: 'heel_raise', target: '10 回 × 1 セット' }
      ] },
      { id: 'cooldown', name: '呼吸とストレッチ', minutes: 3, items: [
        { code: 'breathing', target: '10 回' },
        { code: 'stretch', target: '各 15 秒' }
      ] }
    ]
  }
];

export const programById = (id: number) => PROGRAMS.find((p) => p.id === id) ?? PROGRAMS[0];

/** 今週（月曜始まり）の開始日 */
export function weekStart(d = new Date()): Date {
  const s = new Date(d);
  const dow = (s.getDay() + 6) % 7; // 月=0
  s.setDate(s.getDate() - dow);
  s.setHours(0, 0, 0, 0);
  return s;
}
