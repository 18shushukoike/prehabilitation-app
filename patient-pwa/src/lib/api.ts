import { API_URL, DEMO } from './config';
import type { DailyLog } from './types';

export type SendResult = { ok: true } | { ok: false; error: string; offline?: boolean };
export type VerifyResult = { ok: true; menu_template: number } | { ok: false; message: string };

/**
 * Apps Script ウェブアプリへ送信する。
 * Content-Type を text/plain にすることで CORS preflight を避ける（Apps Script は preflight に応答しない）。
 */
export async function sendLog(log: DailyLog): Promise<SendResult> {
  if (DEMO) {
    await new Promise((r) => setTimeout(r, 500));
    return { ok: true };
  }
  if (!API_URL) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(log),
      redirect: 'follow'
    });
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { ok: boolean; error?: string };
      return j.ok ? { ok: true } : { ok: false, error: j.error || 'unknown' };
    } catch {
      return { ok: false, error: 'bad_response' };
    }
  } catch {
    return { ok: false, error: 'network', offline: true };
  }
}

/** 初期設定時に番号・暗証番号を照合し、メニューの種類を受け取る */
export async function verifyPatient(id: string, pin: string): Promise<VerifyResult> {
  if (DEMO) return { ok: true, menu_template: 1 };
  if (!API_URL) return { ok: false, message: errorMessage('not_configured') };
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'verify', study_id: id, pin }),
      redirect: 'follow'
    });
    const j = JSON.parse(await res.text()) as { ok: boolean; error?: string; menu_template?: number };
    if (j.ok) return { ok: true, menu_template: [1, 2, 3].includes(Number(j.menu_template)) ? Number(j.menu_template) : 1 };
    return { ok: false, message: errorMessage(j.error || 'unknown') };
  } catch {
    return { ok: false, message: errorMessage('network') };
  }
}

export function errorMessage(e: string): string {
  switch (e) {
    case 'invalid_token':
      return '番号または暗証番号が違います。カードをもう一度ご確認ください。';
    case 'locked':
      return '間違いが続いたため、しばらく受け付けられません。時間をおくか、病院にご連絡ください。';
    case 'inactive':
      return 'この番号は現在利用できません。病院にご連絡ください。';
    case 'rate_limited':
      return '送信が多すぎます。少し待ってからもう一度お試しください。';
    case 'not_configured':
      return 'アプリの送信先が設定されていません（開発者向け: VITE_API_URL）。';
    case 'network':
      return '通信できませんでした。電波の良いところで、もう一度お試しください。';
    default:
      return 'うまくいきませんでした。時間をおいてもう一度お試しください。';
  }
}
