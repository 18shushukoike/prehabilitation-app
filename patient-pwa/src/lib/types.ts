export type SessionStatus = 'done' | 'partial' | 'none' | 'not_planned';
export type WalkStatus = 'done' | 'none' | 'rest';

export type ReasonCode =
  | 'fatigue' | 'nausea' | 'fever' | 'pain' | 'numbness' | 'diarrhea'
  | 'chemo_day' | 'no_time' | 'forgot' | 'other';

/** セッション前の体調確認（信号）。green=通常、yellow=軽いメニュー、red=中止 */
export type Signal = 'green' | 'yellow' | 'red';

export type PreSymptom =
  // 赤
  | 'fever' | 'vomiting' | 'dizziness' | 'dehydration' | 'severe_pain' | 'cannot'
  // 黄
  | 'fatigue' | 'mild_nausea' | 'diarrhea' | 'numbness' | 'chemo_day' | 'mild_pain';

export type SessionType = 'normal' | 'mild';

export type PostCondition = 'fine' | 'tired' | 'symptom';
export type PostSymptom = 'dyspnea' | 'dizziness' | 'pain' | 'nausea' | 'exhausted' | 'other';

/** 1 日 1 件の記録（ウォーキングは毎日、セッションは週 3 回） */
export interface DailyLog {
  study_id: string;               // 4 桁の番号
  pin: string;                    // 4 桁の暗証番号
  log_date: string;               // YYYY-MM-DD
  walk_status: WalkStatus;
  walk_min: number | null;
  pre_check: Signal | null;       // セッション前の体調確認の結果（セッションを開かなかった日は null）
  pre_symptoms: PreSymptom[];
  pre_symptom_text: string;       // 「今日は運動できないと感じる」を選んだときの症状の自由記載
  session_planned: boolean;       // 患者が設定した曜日に該当する日か
  session_days: number[];         // 患者が設定した曜日（集計用）
  session_status: SessionStatus;
  session_type: SessionType | null;
  session_min: number | null;
  session_items_done: string[];   // セッションプレイヤーで「できた」を押した種目コード
  reasons: ReasonCode[];          // セッション・ウォーキングができなかった理由（赤信号で中止した場合は不要）
  reason_other: string;
  post_borg: number | null;       // 運動後のきつさ
  post_condition: PostCondition | null;
  post_symptoms: PostSymptom[];
  free_text: string;
  app_version: string;
}

export interface LocalLogSummary {
  log_date: string;
  walk_status: WalkStatus;
  walk_min: number | null;
  session_status: SessionStatus;
  session_type: SessionType | null;
  session_min: number | null;
  pre_check: Signal | null;
  sent: boolean;
}

export interface AppConfig {
  study_id: string;
  pin: string;
  menu_template: number;
  session_days: number[];         // セッションを行う曜日 0=日 … 6=土（患者が設定）
  reminder_time: string;
  font_scale: number;
}

export interface AppState {
  config: AppConfig | null;
  logs: LocalLogSummary[];
  pending: DailyLog[];
}

/** セッションプレイヤーから記録画面へ渡す下書き */
export interface SessionDraft {
  preCheck: Signal;
  preSymptoms: PreSymptom[];
  preSymptomText: string;
  sessionType: SessionType | null;   // 赤で中止した場合は null
  minutes: number;
  itemsDone: string[];
  itemsTotal: number;
}
