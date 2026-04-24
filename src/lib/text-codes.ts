// نظام الأكواد النصية للسداد عن بُعد
// كود الدفع: مدته دقيقتان — كود التأكيد: مدته 5 ساعات — كل كود يُستخدم مرة واحدة
import { db, type PendingOp, type TransactionKind } from "./db";
import { hmacSign, hmacVerify, randomBytes, bufToB64 } from "./crypto";

export const PAYMENT_CODE_TTL = 2 * 60 * 1000;        // دقيقتان
export const APPROVAL_CODE_TTL = 5 * 60 * 60 * 1000;  // 5 ساعات

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // بدون 0/O/1/I/L

function shortCode(len = 10): string {
  const b = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CHARSET[b[i] % CHARSET.length];
  return out.slice(0, 4) + "-" + out.slice(4, 7) + "-" + out.slice(7);
}

// حمولة الكود النصي = MN-T1: + base64(json) + : + signature
// نضمّن البيانات بالكامل ليتمكن المدير من قراءة الكود بدون اتصال
export interface PaymentCodePayload {
  v: 1;
  kind: "payment";
  aid: string;
  aname: string;
  pid: string;
  pname: string;
  amount: number;
  turn: number;
  txKind: TransactionKind;
  ts: number;
  exp: number;
  code: string;
}

export interface ApprovalCodePayload {
  v: 1;
  kind: "approval";
  txId: string;
  aid: string;
  aname: string;
  pid: string;
  pname: string;
  managerId: string;
  managerName: string;
  amount: number;
  turn: number;
  txKind: TransactionKind;
  ts: number;
  exp: number;
  code: string;
}

export type AnyCodePayload = PaymentCodePayload | ApprovalCodePayload;

export function encodeTextCode(p: AnyCodePayload, sig: string): string {
  const json = JSON.stringify(p);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `MN-T1:${b64}:${sig}`;
}

export function decodeTextCode(text: string): { p: AnyCodePayload; sig: string } | null {
  const t = text.trim();
  if (!t.startsWith("MN-T1:")) return null;
  const rest = t.slice(6);
  const idx = rest.lastIndexOf(":");
  if (idx < 0) return null;
  const b64 = rest.slice(0, idx);
  const sig = rest.slice(idx + 1);
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const p = JSON.parse(json) as AnyCodePayload;
    return { p, sig };
  } catch {
    return null;
  }
}

export async function signCodePayload(secret: string, p: AnyCodePayload): Promise<string> {
  return hmacSign(secret, JSON.stringify(p));
}

export async function verifyCodePayload(
  secret: string,
  p: AnyCodePayload,
  sig: string
): Promise<boolean> {
  return hmacVerify(secret, JSON.stringify(p), sig);
}

// إنشاء كود دفع جديد — يرفض إذا كان هناك كود نشط
export async function createPaymentCode(args: {
  hmacSecret: string;
  aid: string;
  aname: string;
  pid: string;
  pname: string;
  amount: number;
  turn: number;
  txKind: TransactionKind;
}): Promise<{ text: string; payload: PaymentCodePayload; expiresAt: number }> {
  // تنظيف منتهيات الصلاحية
  await cleanupExpired();

  // التحقق من عدم وجود كود نشط
  const active = await db.pendingOps
    .where("kind")
    .equals("payment-out")
    .filter((op) => !op.used && op.expiresAt > Date.now() && op.memberPublicId === args.pid)
    .first();
  if (active) {
    throw new Error("لديك كود دفع نشط بالفعل — انتظر انتهاءه أو استخدمه");
  }

  const code = shortCode();
  const ts = Date.now();
  const exp = ts + PAYMENT_CODE_TTL;
  const payload: PaymentCodePayload = {
    v: 1,
    kind: "payment",
    aid: args.aid,
    aname: args.aname,
    pid: args.pid,
    pname: args.pname,
    amount: args.amount,
    turn: args.turn,
    txKind: args.txKind,
    ts,
    exp,
    code,
  };
  const sig = await signCodePayload(args.hmacSecret, payload);
  const text = encodeTextCode(payload, sig);

  const op: PendingOp = {
    id: code,
    kind: "payment-out",
    associationId: args.aid,
    associationName: args.aname,
    amount: args.amount,
    turn: args.turn,
    memberPublicId: args.pid,
    memberName: args.pname,
    txKind: args.txKind,
    createdAt: ts,
    expiresAt: exp,
    text,
  };
  await db.pendingOps.put(op);
  return { text, payload, expiresAt: exp };
}

// إنشاء كود تأكيد الدفع (المدير → العضو)
export async function createApprovalCode(args: {
  hmacSecret: string;
  txId: string;
  aid: string;
  aname: string;
  pid: string;
  pname: string;
  managerId: string;
  managerName: string;
  amount: number;
  turn: number;
  txKind: TransactionKind;
}): Promise<{ text: string; payload: ApprovalCodePayload; expiresAt: number }> {
  await cleanupExpired();
  const code = shortCode();
  const ts = Date.now();
  const exp = ts + APPROVAL_CODE_TTL;
  const payload: ApprovalCodePayload = {
    v: 1,
    kind: "approval",
    txId: args.txId,
    aid: args.aid,
    aname: args.aname,
    pid: args.pid,
    pname: args.pname,
    managerId: args.managerId,
    managerName: args.managerName,
    amount: args.amount,
    turn: args.turn,
    txKind: args.txKind,
    ts,
    exp,
    code,
  };
  const sig = await signCodePayload(args.hmacSecret, payload);
  const text = encodeTextCode(payload, sig);
  const op: PendingOp = {
    id: code,
    kind: "approval-out",
    associationId: args.aid,
    associationName: args.aname,
    amount: args.amount,
    turn: args.turn,
    memberPublicId: args.pid,
    memberName: args.pname,
    managerPublicId: args.managerId,
    managerName: args.managerName,
    txKind: args.txKind,
    createdAt: ts,
    expiresAt: exp,
    text,
    txId: args.txId,
    signature: sig,
  };
  await db.pendingOps.put(op);
  return { text, payload, expiresAt: exp };
}

export async function markCodeUsed(code: string) {
  const op = await db.pendingOps.get(code);
  if (op) await db.pendingOps.update(code, { used: true });
}

export async function cleanupExpired() {
  const now = Date.now();
  await db.pendingOps.where("expiresAt").below(now).delete();
}
