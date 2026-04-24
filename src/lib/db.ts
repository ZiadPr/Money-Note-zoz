// قاعدة البيانات المحلية عبر Dexie (IndexedDB)
// كل البيانات تُخزَّن محليًا بدون أي سيرفر

import Dexie, { type Table } from "dexie";

export type CycleType = "monthly" | "weekly" | "custom";

export interface UserIdentity {
  id: string;                 // UUID
  name: string;
  publicId: string;           // معرف عام يُشارك في QR
  hmacSecret: string;         // سر HMAC المحلي
  deviceUid: string;          // UID مشتق من الجهاز (شبه ثابت)
  deepSecret: string;         // سر باركود تأكيد العمليات العميقة
  createdAt: number;
}

export interface Association {
  id: string;
  name: string;
  installmentAmount: number;
  membersCount: number;
  cycleType: CycleType;
  startDate: number;
  role: "manager" | "member";
  managerId: string;          // publicId للمدير الحالي
  managerName: string;
  managerHmac?: string;       // مفتاح HMAC للمدير لمصادقة العمليات
  // عضوية الدور بالنسبة لي إن كنت عضوًا
  myTurn?: number;
  myPayoutDate?: number;
  // ملكية أصلية (إن نُقلت)
  originalCreatorId?: string;
  originalCreatorName?: string;
  originalCreatorUid?: string;
  originalCreatorQr?: string;
  transferredAt?: number;
  // قبضت دوري؟
  payoutCollected?: boolean;
  payoutCollectedAt?: number;
  createdAt: number;
}

export interface Member {
  id: string;
  associationId: string;
  publicId: string;           // معرف العضو العام (أو manual-xxx)
  deviceUid?: string;         // UID جهاز العضو الموثق
  name: string;
  turn: number;               // ترتيب الدور
  payoutDate: number;
  verified: boolean;          // موثّق بتأكيد ثنائي
  hasPhone: boolean;          // false للمضاف يدويًا
  isManual: boolean;          // مُضاف يدويًا
  handshakeKey?: string;      // مفتاح HMAC مشترك مع هذا العضو
  payoutCollected?: boolean;
  payoutCollectedAt?: number;
  createdAt: number;
}

export type TransactionStatus = "pending" | "approved" | "confirmed" | "cancelled";
export type TransactionKind = "installment" | "payout" | "join" | "transfer";

export interface Transaction {
  id: string;
  associationId: string;
  associationName: string;
  memberId?: string;          // إن كنت مديرًا
  memberPublicId: string;
  memberName: string;
  managerPublicId: string;
  managerName: string;
  amount: number;
  turn: number;
  kind: TransactionKind;      // نوع العملية
  status: TransactionStatus;
  createdAt: number;
  approvedAt?: number;
  confirmedAt?: number;
  cancelledAt?: number;
  signature?: string;         // HMAC
  side: "manager" | "member"; // من سجّل العملية في جهازه
}

// عملية معلقة محلياً (للأكواد النصية): الكود الصادر/المُستقبل
export interface PendingOp {
  id: string;                 // = code
  kind: "payment-out" | "approval-out" | "approval-in";
  associationId: string;
  associationName: string;
  amount: number;
  turn: number;
  memberPublicId: string;
  memberName: string;
  managerPublicId?: string;
  managerName?: string;
  txKind: TransactionKind;
  createdAt: number;
  expiresAt: number;
  used?: boolean;
  text?: string;              // النص الكامل للكود لمشاركته/نسخه لاحقًا
  // للتأكيد الوارد: لربط العملية الأصلية
  txId?: string;
  signature?: string;
}

// سجل عمليات الأمان
export interface SecurityLog {
  id: string;
  kind: "scan" | "confirm" | "deep-confirm" | "reverse-confirm" | "transfer" | "pin";
  detail: string;
  createdAt: number;
}

class MoneyNoteDB extends Dexie {
  identity!: Table<UserIdentity, string>;
  associations!: Table<Association, string>;
  members!: Table<Member, string>;
  transactions!: Table<Transaction, string>;
  pendingOps!: Table<PendingOp, string>;
  securityLogs!: Table<SecurityLog, string>;

  constructor() {
    super("moneynote-db");
    this.version(1).stores({
      identity: "id",
      associations: "id, role, createdAt",
      members: "id, associationId, publicId",
      transactions: "id, associationId, memberPublicId, status, createdAt, side",
    });
    this.version(2).stores({
      identity: "id",
      associations: "id, role, createdAt",
      members: "id, associationId, publicId",
      transactions: "id, associationId, memberPublicId, status, createdAt, side, kind",
      pendingOps: "id, kind, expiresAt, associationId",
      securityLogs: "id, createdAt, kind",
    });
  }
}

export const db = new MoneyNoteDB();

// مساعد لإضافة سجل أمني
export async function logSecurity(kind: SecurityLog["kind"], detail: string) {
  await db.securityLogs.add({
    id: crypto.randomUUID(),
    kind,
    detail,
    createdAt: Date.now(),
  });
}
