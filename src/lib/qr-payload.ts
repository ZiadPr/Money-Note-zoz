// أنواع حمولات الـ QR وأدوات الترميز
import { hmacSign, hmacVerify } from "./crypto";

export type QrType =
  | "identity"
  | "association"
  | "join-association"
  | "join-ack"
  | "payment"
  | "approval"
  | "history"
  | "deep-confirm"
  | "transfer"
  | "transfer-ack";

export interface IdentityQr {
  t: "identity";
  pid: string;        // publicId
  name: string;
  uid: string;        // device UID
  hmac: string;       // مفتاح HMAC العام لتبادل handshake
}

export interface AssociationQr {
  t: "association";
  aid: string;        // associationId
  name: string;
  amount: number;
  cycle: "monthly" | "weekly" | "custom";
  members: number;
  managerId: string;
  managerName: string;
  managerHmac: string;
}

export interface JoinAssociationQr {
  t: "join-association";
  aid: string;
  name: string;
  amount: number;
  cycle: "monthly" | "weekly" | "custom";
  members: number;
  startDate: number;
  managerId: string;
  managerName: string;
  managerHmac: string;
  memberId: string;
  memberName: string;
  memberUid: string;
  turn: number;
  payoutDate: number;
  ts: number;
  exp: number;
  sig: string;
}

export interface JoinAckQr {
  t: "join-ack";
  aid: string;
  memberId: string;
  memberName: string;
  memberUid: string;
  turn: number;
  ts: number;
  sig: string;
}

export interface PaymentQr {
  t: "payment";
  aid: string;
  pid: string;        // publicId للعضو
  name: string;
  amount: number;
  turn: number;
  kind: "installment" | "payout";
  ts: number;         // طابع زمني (window 10s)
  sig: string;        // HMAC على الحمولة
}

export interface ApprovalQr {
  t: "approval";
  txId: string;
  aid: string;
  pid: string;
  amount: number;
  turn: number;
  kind: "installment" | "payout";
  managerId: string;
  managerName: string;
  ts: number;
  nonce: string;
  sig: string;
}

export interface HistoryQr {
  t: "history";
  pid: string;
  name: string;
  associations: { aid: string; name: string; turn: number }[];
  txs: { id: string; aid: string; amount: number; date: number; turn: number }[];
}

// باركود تأكيد العمليات العميقة (متغير دوري)
export interface DeepConfirmQr {
  t: "deep-confirm";
  pid: string;
  uid: string;
  name: string;
  ts: number;
  sig: string;        // HMAC على pid|uid|ts بالـ deepSecret
}

// باركود نقل ملكية الجمعية
export interface TransferQr {
  t: "transfer";
  aid: string;
  aname: string;
  fromManagerId: string;
  fromManagerName: string;
  fromManagerUid?: string;
  toMemberId: string;
  toMemberName: string;
  originalCreatorId?: string;
  originalCreatorName?: string;
  originalCreatorUid?: string;
  originalCreatorQr?: string;
  ts: number;
  sig: string;
}

export interface TransferAckQr {
  t: "transfer-ack";
  aid: string;
  aname: string;
  fromManagerId: string;
  toManagerId: string;
  toManagerName: string;
  toManagerUid: string;
  ts: number;
  sig: string;
}

export type AnyQr =
  | IdentityQr
  | AssociationQr
  | JoinAssociationQr
  | JoinAckQr
  | PaymentQr
  | ApprovalQr
  | HistoryQr
  | DeepConfirmQr
  | TransferQr
  | TransferAckQr;

export function encodeQr(payload: AnyQr): string {
  return "MN1:" + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

export function decodeQr(text: string): AnyQr | null {
  try {
    if (!text.startsWith("MN1:")) return null;
    const json = decodeURIComponent(escape(atob(text.slice(4))));
    return JSON.parse(json) as AnyQr;
  } catch {
    return null;
  }
}

// نافذة 10 ثوانٍ للدفع
export const PAYMENT_WINDOW_MS = 10_000;
// نافذة باركود التأكيد العميق (يتجدد كل 30ث)
export const DEEP_CONFIRM_WINDOW_MS = 30_000;
// مهلة جلسة الانضمام
export const JOIN_SESSION_MS = 5 * 60 * 1000;

export async function signPayment(secret: string, p: Omit<PaymentQr, "sig" | "t">): Promise<string> {
  const msg = `${p.aid}|${p.pid}|${p.amount}|${p.turn}|${p.kind}|${p.ts}`;
  return hmacSign(secret, msg);
}

export async function verifyPayment(secret: string, p: PaymentQr): Promise<boolean> {
  const msg = `${p.aid}|${p.pid}|${p.amount}|${p.turn}|${p.kind}|${p.ts}`;
  return hmacVerify(secret, msg, p.sig);
}

export async function signApproval(secret: string, a: Omit<ApprovalQr, "sig" | "t">): Promise<string> {
  const msg = `${a.txId}|${a.aid}|${a.pid}|${a.amount}|${a.turn}|${a.kind}|${a.ts}|${a.nonce}`;
  return hmacSign(secret, msg);
}

export async function signDeepConfirm(secret: string, pid: string, uid: string, ts: number): Promise<string> {
  return hmacSign(secret, `${pid}|${uid}|${ts}`);
}

export async function verifyDeepConfirm(secret: string, q: DeepConfirmQr): Promise<boolean> {
  return hmacVerify(secret, `${q.pid}|${q.uid}|${q.ts}`, q.sig);
}

export async function signJoinAssociation(
  secret: string,
  q: Omit<JoinAssociationQr, "t" | "sig" | "managerHmac">
): Promise<string> {
  return hmacSign(
    secret,
    `${q.aid}|${q.memberId}|${q.memberUid}|${q.turn}|${q.payoutDate}|${q.ts}|${q.exp}`
  );
}

export async function verifyJoinAssociation(secret: string, q: JoinAssociationQr): Promise<boolean> {
  return hmacVerify(
    secret,
    `${q.aid}|${q.memberId}|${q.memberUid}|${q.turn}|${q.payoutDate}|${q.ts}|${q.exp}`,
    q.sig
  );
}

export async function signJoinAck(
  secret: string,
  q: Omit<JoinAckQr, "t" | "sig">
): Promise<string> {
  return hmacSign(secret, `${q.aid}|${q.memberId}|${q.memberUid}|${q.turn}|${q.ts}`);
}

export async function verifyJoinAck(secret: string, q: JoinAckQr): Promise<boolean> {
  return hmacVerify(secret, `${q.aid}|${q.memberId}|${q.memberUid}|${q.turn}|${q.ts}`, q.sig);
}

export async function signTransfer(
  secret: string,
  t: Omit<TransferQr, "sig" | "t">
): Promise<string> {
  return hmacSign(secret, `${t.aid}|${t.fromManagerId}|${t.toMemberId}|${t.ts}`);
}

export async function verifyTransfer(secret: string, t: TransferQr): Promise<boolean> {
  return hmacVerify(secret, `${t.aid}|${t.fromManagerId}|${t.toMemberId}|${t.ts}`, t.sig);
}

export async function signTransferAck(
  secret: string,
  t: Omit<TransferAckQr, "sig" | "t">
): Promise<string> {
  return hmacSign(secret, `${t.aid}|${t.fromManagerId}|${t.toManagerId}|${t.toManagerUid}|${t.ts}`);
}

export async function verifyTransferAck(secret: string, t: TransferAckQr): Promise<boolean> {
  return hmacVerify(secret, `${t.aid}|${t.fromManagerId}|${t.toManagerId}|${t.toManagerUid}|${t.ts}`, t.sig);
}
