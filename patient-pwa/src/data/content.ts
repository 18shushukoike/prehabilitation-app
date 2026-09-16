import type { PostSymptom, PreSymptom, ReasonCode, Signal } from '../lib/types';

export const REASONS: { code: ReasonCode; label: string }[] = [
  { code: 'fatigue', label: 'だるさ' },
  { code: 'nausea', label: '吐き気・食欲がない' },
  { code: 'fever', label: '熱がある' },
  { code: 'pain', label: '痛み' },
  { code: 'numbness', label: 'しびれ・ふらつき' },
  { code: 'diarrhea', label: '下痢' },
  { code: 'chemo_day', label: '点滴の日' },
  { code: 'no_time', label: '時間がなかった' },
  { code: 'forgot', label: '忘れていた' },
  { code: 'other', label: 'その他' }
];

/** セッション前の体調確認。level=red が 1 つでもあれば赤、yellow のみなら黄、なしなら青 */
export const PRE_CHECK: { code: PreSymptom; label: string; level: 'red' | 'yellow' }[] = [
  { code: 'fever', label: '38 ℃以上の熱がある', level: 'red' },
  { code: 'vomiting', label: '強い吐き気・嘔吐がある', level: 'red' },
  { code: 'dizziness', label: 'ふらつき・めまいがある', level: 'red' },
  { code: 'dehydration', label: '口が渇く・尿が少ない（脱水気味）', level: 'red' },
  { code: 'severe_pain', label: '強い痛みがある', level: 'red' },
  { code: 'cannot', label: '今日は運動できないと感じる', level: 'red' },
  { code: 'fatigue', label: 'だるい', level: 'yellow' },
  { code: 'mild_nausea', label: '軽い吐き気・食欲がない', level: 'yellow' },
  { code: 'diarrhea', label: '下痢ぎみ', level: 'yellow' },
  { code: 'numbness', label: '手足がしびれる', level: 'yellow' },
  { code: 'chemo_day', label: '点滴の当日・翌日', level: 'yellow' },
  { code: 'mild_pain', label: '軽い痛みがある', level: 'yellow' }
];

export function judgeSignal(codes: PreSymptom[]): Signal {
  const levels = PRE_CHECK.filter((p) => codes.includes(p.code)).map((p) => p.level);
  if (levels.includes('red')) return 'red';
  if (levels.includes('yellow')) return 'yellow';
  return 'green';
}

export const SIGNAL_LABEL: Record<Signal, { title: string; body: string; color: string }> = {
  green: { title: '青信号: いつも通り運動できます', body: '通常のセッションを行いましょう。', color: '#1e7b4f' },
  yellow: { title: '黄信号: 今日は軽めにしましょう', body: '5〜10 分の軽いメニューにします。つらければ途中でやめて構いません。', color: '#b8860b' },
  red: { title: '赤信号: 今日は運動を中止しましょう', body: '無理をせず休んでください。症状が強いとき、続くときは病院にご連絡ください。', color: '#b3261e' }
};

/** 運動後の体調 */
export const POST_CONDITION: { code: 'fine' | 'tired' | 'symptom'; label: string }[] = [
  { code: 'fine', label: '問題なし' },
  { code: 'tired', label: '少し疲れた・つらかった' },
  { code: 'symptom', label: '症状が出た' }
];

export const POST_SYMPTOMS: { code: PostSymptom; label: string }[] = [
  { code: 'dyspnea', label: '息切れ・動悸' },
  { code: 'dizziness', label: 'めまい・ふらつき' },
  { code: 'pain', label: '痛み' },
  { code: 'nausea', label: '吐き気' },
  { code: 'exhausted', label: '強い疲れ' },
  { code: 'other', label: 'その他' }
];

export const BORG: { value: number; label: string; face: string }[] = [
  { value: 0, label: '何ともない', face: '😊' },
  { value: 1, label: 'とても楽', face: '😊' },
  { value: 2, label: '楽', face: '🙂' },
  { value: 3, label: 'ややきつい', face: '😐' },
  { value: 4, label: 'ややきつい', face: '😐' },
  { value: 5, label: 'きつい', face: '😣' },
  { value: 6, label: 'きつい', face: '😣' },
  { value: 7, label: 'とてもきつい', face: '😫' },
  { value: 8, label: 'とてもきつい', face: '😫' },
  { value: 9, label: '非常にきつい', face: '😵' },
  { value: 10, label: '限界', face: '😵' }
];

export interface Article {
  id: string;
  title: string;
  body: string[];
  videoUrl?: string;
}

export const ARTICLES: Article[] = [
  {
    id: 'why',
    title: 'なぜ手術前に運動するの？',
    body: [
      '抗がん剤治療の間は、体を動かす機会が減って筋肉が落ちやすくなります。',
      '筋肉と体力を保っておくと、手術後の回復が早く、合併症も起こりにくいことが分かっています。',
      '毎日少しずつで構いません。「できた日」を増やしていきましょう。'
    ]
  },
  {
    id: 'chemo',
    title: '点滴の日の過ごし方',
    body: [
      '点滴の当日と翌日は無理をせず、体調がよければ深呼吸とストレッチだけでも構いません。',
      '熱や強いだるさがあるときは休みましょう。休んだ日も「休む日」として送ってください。'
    ]
  },
  {
    id: 'protein',
    title: 'たんぱく質をとりましょう',
    body: [
      '運動で筋肉をつくるには材料が必要です。肉・魚・卵・大豆・乳製品を毎食とりましょう。',
      '食欲がないときは、栄養補助飲料や少量ずつ回数を分けて食べる方法があります。外来で栄養士に相談できます。'
    ]
  },
  {
    id: 'breathing',
    title: '呼吸の練習が大切な理由',
    body: [
      'お腹の手術の後は痛みで呼吸が浅くなり、肺炎を起こしやすくなります。',
      '手術前から深呼吸に慣れておくと、手術後も上手に呼吸ができ、肺炎を防ぐことにつながります。'
    ]
  },
  {
    id: 'flow',
    title: '手術までの流れ',
    body: [
      '抗がん剤治療を数か月行い、効果を確認してから手術の時期を決めます。',
      'その間、体力を保つために自宅での運動を続けます。',
      '分からないことは外来で遠慮なく聞いてください。'
    ]
  }
];
