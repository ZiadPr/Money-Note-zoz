// إدارة جلسة الانضمام (5 دقائق) — تخزين في sessionStorage
import type { IdentityQr } from "./qr-payload";

const KEY = "mn-join-session";
const TTL = 5 * 60 * 1000;

export interface JoinSession {
  associationId: string;
  candidate: { pid: string; uid: string; name: string; hmac: string };
  deepConfirmed: boolean;
  pendingMemberId?: string;
  pendingTurn?: number;
  startedAt: number;
}

export function startJoinSession(associationId: string, candidate: JoinSession["candidate"]) {
  const s: JoinSession = { associationId, candidate, deepConfirmed: false, startedAt: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

export function getJoinSession(): JoinSession | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as JoinSession;
    if (Date.now() - s.startedAt > TTL) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function updateJoinSession(patch: Partial<JoinSession>) {
  const cur = getJoinSession();
  if (!cur) return null;
  const next = { ...cur, ...patch };
  sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearJoinSession() {
  sessionStorage.removeItem(KEY);
}
