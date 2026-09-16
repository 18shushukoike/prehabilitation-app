export const API_URL = import.meta.env.VITE_API_URL as string | undefined;
export const HOSPITAL_PHONE = (import.meta.env.VITE_HOSPITAL_PHONE as string) || '（病院の電話番号を設定してください）';
export const HOSPITAL_NAME = (import.meta.env.VITE_HOSPITAL_NAME as string) || '病院';
export const APP_VERSION = '0.1.0';
/** デモ版: 送信を行わず端末内に保存するだけ（見た目の確認用） */
export const DEMO = import.meta.env.VITE_DEMO === '1';
