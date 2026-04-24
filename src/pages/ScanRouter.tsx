import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Crown,
  LockKeyhole,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QRScanner } from "@/components/QRScanner";
import { QRDisplay } from "@/components/QRDisplay";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import {
  decodeQr,
  encodeQr,
  signApproval,
  signJoinAck,
  signJoinAssociation,
  signTransferAck,
  verifyDeepConfirm,
  verifyJoinAck,
  verifyJoinAssociation,
  verifyPayment,
  verifyTransfer,
  verifyTransferAck,
  JOIN_SESSION_MS,
  type ApprovalQr,
  type AssociationQr,
  type DeepConfirmQr,
  type HistoryQr,
  type IdentityQr,
  type JoinAckQr,
  type JoinAssociationQr,
  type PaymentQr,
  type TransferAckQr,
  type TransferQr,
} from "@/lib/qr-payload";
import { db, type Association, type Member, type Transaction, logSecurity } from "@/lib/db";
import { uuid } from "@/lib/crypto";
import { useIdentity } from "@/hooks/useIdentity";
import { formatAmount, formatDate, formatDateTime } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { clearJoinSession, getJoinSession, startJoinSession, updateJoinSession } from "@/lib/join-session";

type ScanState =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "identity"; qr: IdentityQr }
  | { kind: "association-locked" }
  | { kind: "join-association"; data: JoinAssociationQr }
  | { kind: "deep-confirm"; assoc: Association; pendingMember: Member; joinInviteQr: string }
  | { kind: "manager-join-complete"; assoc: Association; member: Member }
  | { kind: "member-join-complete"; assocId: string; assocName: string; turn: number; ackQr: string }
  | { kind: "payment"; data: PaymentQr; member: Member; assoc: Association }
  | { kind: "approval"; data: ApprovalQr; assoc?: Association }
  | { kind: "history"; data: HistoryQr }
  | { kind: "transfer"; data: TransferQr }
  | { kind: "manager-transfer-complete"; assoc: Association; newManagerName: string };

export default function ScanRouter() {
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const [state, setState] = useState<ScanState>({ kind: "scanning" });
  const [approvalQr, setApprovalQr] = useState<string | null>(null);
  const [memberTurn, setMemberTurn] = useState("");
  const [assocPickerOpen, setAssocPickerOpen] = useState(false);
  const [pickedAssocId, setPickedAssocId] = useState<string>("");
  const [myAssocs, setMyAssocs] = useState<Association[]>([]);
  const [vacantSlots, setVacantSlots] = useState<number[]>([]);

  useEffect(() => {
    if (!pickedAssocId) {
      setVacantSlots([]);
      return;
    }

    (async () => {
      const assoc = await db.associations.get(pickedAssocId);
      if (!assoc) return;

      const members = await db.members.where("associationId").equals(pickedAssocId).toArray();
      const taken = new Set(members.map((member) => member.turn));
      const slots: number[] = [];

      for (let turn = 1; turn <= assoc.membersCount; turn += 1) {
        if (!taken.has(turn)) slots.push(turn);
      }

      setVacantSlots(slots);
      setMemberTurn(slots[0] ? String(slots[0]) : "");
    })();
  }, [pickedAssocId]);

  const finalizeJoinOnManager = async (qr: JoinAckQr) => {
    const session = getJoinSession();
    if (!session || !session.deepConfirmed) {
      toast({
        title: "لا توجد جلسة انضمام نشطة",
        description: "ابدأ من مسح QR العضو ثم التأكيد العميق أولًا",
        variant: "destructive",
      });
      return;
    }

    if (
      session.associationId !== qr.aid ||
      session.candidate.pid !== qr.memberId ||
      session.candidate.uid !== qr.memberUid ||
      session.pendingTurn !== qr.turn
    ) {
      toast({ title: "باركود الإتمام لا يطابق جلسة الانضمام الحالية", variant: "destructive" });
      return;
    }

    if (Date.now() - qr.ts > JOIN_SESSION_MS) {
      clearJoinSession();
      toast({
        title: "انتهت مهلة جلسة الانضمام",
        description: "ابدأ العملية من الصفر",
        variant: "destructive",
      });
      return;
    }

    const assoc = await db.associations.get(qr.aid);
    if (!assoc) {
      toast({ title: "الجمعية غير موجودة على جهاز المدير", variant: "destructive" });
      return;
    }

    const member = await db.members
      .where("associationId")
      .equals(qr.aid)
      .filter((item) => item.publicId === qr.memberId)
      .first();

    if (!member) {
      toast({ title: "لم يتم العثور على العضو المعلّق", variant: "destructive" });
      return;
    }

    const valid = await verifyJoinAck(member.handshakeKey ?? session.candidate.hmac, qr);
    if (!valid) {
      toast({ title: "باركود إتمام الانضمام غير صحيح", variant: "destructive" });
      return;
    }

    await db.members.update(member.id, {
      verified: true,
      deviceUid: qr.memberUid,
    });

    await db.transactions.add({
      id: uuid(),
      associationId: assoc.id,
      associationName: assoc.name,
      memberId: member.id,
      memberPublicId: member.publicId,
      memberName: member.name,
      managerPublicId: assoc.managerId,
      managerName: assoc.managerName,
      amount: 0,
      turn: member.turn,
      kind: "join",
      status: "confirmed",
      createdAt: Date.now(),
      approvedAt: session.startedAt,
      confirmedAt: Date.now(),
      signature: qr.sig,
      side: "manager",
    });

    await logSecurity("reverse-confirm", `اكتمل انضمام ${member.name} إلى ${assoc.name}`);
    clearJoinSession();

    setState({
      kind: "manager-join-complete",
      assoc,
      member: { ...member, verified: true, deviceUid: qr.memberUid },
    });
  };

  const finalizeTransferOnManager = async (qr: TransferAckQr) => {
    if (!identity) return;

    const assoc = await db.associations.get(qr.aid);
    if (!assoc) {
      toast({ title: "الجمعية غير موجودة على جهاز المدير", variant: "destructive" });
      return;
    }

    if (assoc.managerId !== identity.publicId || qr.fromManagerId !== identity.publicId) {
      toast({ title: "هذا باركود إتمام نقل لا يخصك", variant: "destructive" });
      return;
    }

    const member = await db.members
      .where("associationId")
      .equals(qr.aid)
      .filter((item) => item.publicId === qr.toManagerId)
      .first();

    if (!member || !member.handshakeKey) {
      toast({ title: "لا يمكن التحقق من المدير الجديد", variant: "destructive" });
      return;
    }

    const valid = await verifyTransferAck(member.handshakeKey, qr);
    if (!valid) {
      toast({ title: "باركود إتمام النقل غير صحيح", variant: "destructive" });
      return;
    }

    await db.associations.update(assoc.id, {
      role: "member",
      managerId: qr.toManagerId,
      managerName: qr.toManagerName,
      managerHmac: member.handshakeKey,
      transferredAt: qr.ts,
    });

    await db.transactions.add({
      id: uuid(),
      associationId: assoc.id,
      associationName: assoc.name,
      memberId: member.id,
      memberPublicId: member.publicId,
      memberName: member.name,
      managerPublicId: identity.publicId,
      managerName: identity.name,
      amount: 0,
      turn: member.turn,
      kind: "transfer",
      status: "confirmed",
      createdAt: Date.now(),
      approvedAt: qr.ts,
      confirmedAt: Date.now(),
      signature: qr.sig,
      side: "manager",
    });

    await logSecurity("transfer", `اكتمل نقل ${assoc.name} إلى ${qr.toManagerName}`);
    setState({
      kind: "manager-transfer-complete",
      assoc: { ...assoc, role: "member", managerId: qr.toManagerId, managerName: qr.toManagerName, managerHmac: member.handshakeKey, transferredAt: qr.ts },
      newManagerName: qr.toManagerName,
    });
  };

  const handleResult = async (text: string) => {
    const qr = decodeQr(text);
    if (!qr) {
      toast({ title: "باركود غير صالح", variant: "destructive" });
      return;
    }

    await logSecurity("scan", `نوع: ${qr.t}`);

    if (qr.t === "identity") {
      const mine = await db.associations.where("role").equals("manager").toArray();
      if (mine.length === 0) {
        toast({ title: "ليس لديك جمعيات تديرها", variant: "destructive" });
        setState({ kind: "scanning" });
        return;
      }

      setMyAssocs(mine);
      setPickedAssocId(mine[0].id);
      setState({ kind: "identity", qr });
      setAssocPickerOpen(true);
      return;
    }

    if (qr.t === "association") {
      const exists = await db.associations.get(qr.aid);
      if (exists) {
        toast({ title: "هذه الجمعية مضافة بالفعل" });
        navigate(`/associations/${qr.aid}`);
        return;
      }

      setState({ kind: "association-locked" });
      return;
    }

    if (qr.t === "join-association") {
      if (!identity) return;

      if (qr.memberId !== identity.publicId || qr.memberUid !== identity.deviceUid) {
        toast({ title: "هذا الباركود ليس موجهًا إلى جهازك", variant: "destructive" });
        return;
      }

      if (Date.now() > qr.exp) {
        toast({
          title: "انتهت جلسة الانضمام",
          description: "اطلب من المدير بدء الجلسة من جديد",
          variant: "destructive",
        });
        return;
      }

      const valid = await verifyJoinAssociation(qr.managerHmac, qr);
      if (!valid) {
        toast({ title: "باركود الانضمام غير صحيح", variant: "destructive" });
        return;
      }

      const exists = await db.associations.get(qr.aid);
      if (exists) {
        toast({ title: "هذه الجمعية مضافة بالفعل" });
        navigate(`/associations/${qr.aid}`);
        return;
      }

      setState({ kind: "join-association", data: qr });
      return;
    }

    if (qr.t === "join-ack") {
      await finalizeJoinOnManager(qr);
      return;
    }

    if (qr.t === "deep-confirm") {
      const session = getJoinSession();
      if (!session) {
        toast({
          title: "لا توجد جلسة انضمام نشطة",
          description: "ابدأ بمسح هوية العضو أولًا",
          variant: "destructive",
        });
        setState({ kind: "scanning" });
        return;
      }

      if (session.candidate.pid !== qr.pid || session.candidate.uid !== qr.uid) {
        toast({ title: "هذا ليس باركود الشخص الذي بدأت معه", variant: "destructive" });
        return;
      }

      const valid = await verifyDeepConfirm(session.candidate.hmac, qr);
      if (!valid) {
        toast({ title: "توقيع باركود التأكيد غير صحيح", variant: "destructive" });
        return;
      }

      if (Date.now() - qr.ts > 60_000) {
        toast({ title: "الباركود منتهٍ", description: "اطلب من العضو تجديده", variant: "destructive" });
        return;
      }

      if (!session.pendingTurn) {
        toast({ title: "لم يتم تحديد دور للعضو", variant: "destructive" });
        return;
      }

      const assoc = await db.associations.get(session.associationId);
      if (!assoc) {
        toast({ title: "الجمعية المحددة غير موجودة", variant: "destructive" });
        return;
      }

      const existingMember = await db.members
        .where("associationId")
        .equals(assoc.id)
        .filter((member) => member.publicId === session.candidate.pid)
        .first();

      if (existingMember) {
        toast({ title: "هذا العضو مضاف بالفعل في الجمعية", variant: "destructive" });
        clearJoinSession();
        setState({ kind: "scanning" });
        return;
      }

      const turnTaken = await db.members
        .where("associationId")
        .equals(assoc.id)
        .filter((member) => member.turn === session.pendingTurn)
        .first();

      if (turnTaken) {
        toast({ title: "الدور المحدد أصبح مشغولًا", description: "اختر دورًا آخر", variant: "destructive" });
        clearJoinSession();
        setState({ kind: "scanning" });
        return;
      }

      const member: Member = {
        id: uuid(),
        associationId: assoc.id,
        publicId: session.candidate.pid,
        deviceUid: session.candidate.uid,
        name: session.candidate.name,
        turn: session.pendingTurn,
        payoutDate: assoc.startDate + (session.pendingTurn - 1) * 30 * 86400000,
        verified: false,
        hasPhone: true,
        isManual: false,
        handshakeKey: session.candidate.hmac,
        createdAt: Date.now(),
      };

      await db.members.put(member);
      updateJoinSession({
        deepConfirmed: true,
        pendingMemberId: member.id,
        pendingTurn: member.turn,
      });

      const inviteBase = {
        aid: assoc.id,
        name: assoc.name,
        amount: assoc.installmentAmount,
        cycle: assoc.cycleType,
        members: assoc.membersCount,
        startDate: assoc.startDate,
        managerId: assoc.managerId,
        managerName: assoc.managerName,
        memberId: member.publicId,
        memberName: member.name,
        memberUid: member.deviceUid ?? session.candidate.uid,
        turn: member.turn,
        payoutDate: member.payoutDate,
        ts: Date.now(),
        exp: Date.now() + JOIN_SESSION_MS,
      };

      const joinInvite: JoinAssociationQr = {
        t: "join-association",
        ...inviteBase,
        managerHmac: identity?.hmacSecret ?? assoc.managerHmac ?? "",
        sig: await signJoinAssociation(identity?.hmacSecret ?? assoc.managerHmac ?? "", inviteBase),
      };

      await logSecurity("deep-confirm", `${member.name} في ${assoc.name}`);

      setState({
        kind: "deep-confirm",
        assoc,
        pendingMember: member,
        joinInviteQr: encodeQr(joinInvite),
      });
      return;
    }

    if (qr.t === "payment") {
      const member = await db.members.where("publicId").equals(qr.pid).first();
      const assoc = await db.associations.get(qr.aid);
      if (!member || !assoc) {
        toast({ title: "العضو/الجمعية غير معروفة", variant: "destructive" });
        setState({ kind: "scanning" });
        return;
      }

      if (member.handshakeKey) {
        const valid = await verifyPayment(member.handshakeKey, qr);
        if (!valid) {
          toast({ title: "توقيع باركود غير صحيح", variant: "destructive" });
          return;
        }
      }

      if (Date.now() - qr.ts > 30_000) {
        toast({ title: "الباركود منتهٍ", description: "اطلب من العضو تجديده", variant: "destructive" });
        return;
      }

      setState({ kind: "payment", data: qr, member, assoc });
      return;
    }

    if (qr.t === "approval") {
      const assoc = await db.associations.get(qr.aid);
      setState({ kind: "approval", data: qr, assoc: assoc ?? undefined });
      return;
    }

    if (qr.t === "history") {
      setState({ kind: "history", data: qr });
      return;
    }

    if (qr.t === "transfer") {
      const assoc = await db.associations.get(qr.aid);
      if (!assoc) {
        toast({ title: "لست عضوًا معتمدًا في هذه الجمعية", variant: "destructive" });
        return;
      }
      setState({ kind: "transfer", data: qr });
      return;
    }

    if (qr.t === "transfer-ack") {
      await finalizeTransferOnManager(qr);
    }
  };

  const startAddMember = async () => {
    if (state.kind !== "identity" || !pickedAssocId || !memberTurn) return;

    startJoinSession(pickedAssocId, {
      pid: state.qr.pid,
      uid: state.qr.uid,
      name: state.qr.name,
      hmac: state.qr.hmac,
    });
    updateJoinSession({ pendingTurn: Number(memberTurn) });

    setAssocPickerOpen(false);
    toast({
      title: `تم تحضير الإضافة لـ ${state.qr.name}`,
      description: "الخطوة التالية: امسح باركود تأكيد العمليات العميقة من جهاز العضو",
    });
    setState({ kind: "scanning" });
  };

  const confirmJoinMembership = async () => {
    if (state.kind !== "join-association" || !identity) return;

    const data = state.data;
    const existing = await db.associations.get(data.aid);
    if (existing) {
      toast({ title: "هذه الجمعية مضافة بالفعل" });
      navigate(`/associations/${data.aid}`);
      return;
    }

    const assoc: Association = {
      id: data.aid,
      name: data.name,
      installmentAmount: data.amount,
      membersCount: data.members,
      cycleType: data.cycle,
      startDate: data.startDate,
      role: "member",
      managerId: data.managerId,
      managerName: data.managerName,
      managerHmac: data.managerHmac,
      myTurn: data.turn,
      myPayoutDate: data.payoutDate,
      createdAt: Date.now(),
    };

    await db.associations.put(assoc);
    await db.transactions.add({
      id: uuid(),
      associationId: assoc.id,
      associationName: assoc.name,
      memberPublicId: identity.publicId,
      memberName: identity.name,
      managerPublicId: assoc.managerId,
      managerName: assoc.managerName,
      amount: 0,
      turn: data.turn,
      kind: "join",
      status: "confirmed",
      createdAt: Date.now(),
      approvedAt: data.ts,
      confirmedAt: Date.now(),
      signature: data.sig,
      side: "member",
    });

    const ackBase = {
      aid: data.aid,
      memberId: identity.publicId,
      memberName: identity.name,
      memberUid: identity.deviceUid,
      turn: data.turn,
      ts: Date.now(),
    };
    const ackPayload: JoinAckQr = {
      t: "join-ack",
      ...ackBase,
      sig: await signJoinAck(identity.hmacSecret, ackBase),
    };

    await logSecurity("reverse-confirm", `تأكيد الانضمام إلى ${data.name}`);
    toast({
      title: `تمت إضافة ${data.name}`,
      description: "اعرض باركود الإتمام على المدير ليظهر توثيق العضو داخل الجمعية",
    });

    setState({
      kind: "member-join-complete",
      assocId: data.aid,
      assocName: data.name,
      turn: data.turn,
      ackQr: encodeQr(ackPayload),
    });
  };

  const approvePayment = async () => {
    if (state.kind !== "payment" || !identity) return;

    const txId = uuid();
    const nonce = uuid();
    const base = {
      txId,
      aid: state.data.aid,
      pid: state.data.pid,
      amount: state.data.amount,
      turn: state.data.turn,
      kind: state.data.kind,
      managerId: identity.publicId,
      managerName: identity.name,
      ts: Date.now(),
      nonce,
    };

    const sig = await signApproval(identity.hmacSecret, base);
    const approval: ApprovalQr = { t: "approval", ...base, sig };

    const tx: Transaction = {
      id: txId,
      associationId: state.data.aid,
      associationName: state.assoc.name,
      memberId: state.member.id,
      memberPublicId: state.data.pid,
      memberName: state.data.name,
      managerPublicId: identity.publicId,
      managerName: identity.name,
      amount: state.data.amount,
      turn: state.data.turn,
      kind: state.data.kind,
      status: state.member.isManual ? "confirmed" : "approved",
      createdAt: Date.now(),
      approvedAt: Date.now(),
      confirmedAt: state.member.isManual ? Date.now() : undefined,
      signature: sig,
      side: "manager",
    };

    await db.transactions.add(tx);

    if (state.data.kind === "payout") {
      await db.members.update(state.member.id, {
        payoutCollected: true,
        payoutCollectedAt: Date.now(),
      });
    }

    if (state.member.isManual) {
      toast({ title: "تم تسجيل العملية للعضو اليدوي" });
      navigate("/history");
      return;
    }

    setApprovalQr(encodeQr(approval));
  };

  const confirmReceipt = async () => {
    if (state.kind !== "approval" || !identity) return;

    const exists = await db.transactions.get(state.data.txId);
    if (exists) {
      toast({ title: "تم تأكيد هذه العملية مسبقًا" });
      navigate("/history");
      return;
    }

    const tx: Transaction = {
      id: state.data.txId,
      associationId: state.data.aid,
      associationName: state.assoc?.name ?? "—",
      memberPublicId: state.data.pid,
      memberName: identity.name,
      managerPublicId: state.data.managerId,
      managerName: state.data.managerName,
      amount: state.data.amount,
      turn: state.data.turn,
      kind: state.data.kind,
      status: "confirmed",
      createdAt: Date.now(),
      approvedAt: state.data.ts,
      confirmedAt: Date.now(),
      signature: state.data.sig,
      side: "member",
    };

    await db.transactions.add(tx);

    if (state.data.kind === "payout" && state.assoc) {
      await db.associations.update(state.assoc.id, {
        payoutCollected: true,
        payoutCollectedAt: Date.now(),
      });
    }

    toast({ title: "تم تأكيد الاستلام", description: "سُجِّلت العملية في سجلك" });
    navigate("/history");
  };

  if (state.kind === "scanning") {
    return <QRScanner onResult={handleResult} onClose={() => navigate(-1)} />;
  }

  return (
    <AppShell hideNav>
      <AppHeader title="نتيجة المسح" back />

      <div className="p-4 animate-fade-in">
        {state.kind === "association-locked" && (
          <Card className="card-elevated p-5 space-y-3 border-warning/40 text-center">
            <LockKeyhole className="size-12 text-warning mx-auto" />
            <h3 className="font-bold text-lg">لست عضوًا معتمدًا في هذه الجمعية</h3>
            <p className="text-sm text-muted-foreground">
              مسح QR الجمعية وحده لا يسمح بالانضمام. يجب أن يبدأ المدير العملية من جهازه ثم يرسل لك QR الجلسة المخصص.
            </p>
            <Button onClick={() => navigate("/settings")} variant="outline" className="w-full">
              الذهاب إلى الإعدادات
            </Button>
          </Card>
        )}

        {state.kind === "join-association" && (
          <Card className="card-elevated p-5 space-y-3 border-primary/30">
            <QrCode className="size-10 text-primary mx-auto" />
            <h3 className="font-bold text-center text-lg">تأكيد الانضمام إلى الجمعية</h3>
            <Row label="الجمعية" value={state.data.name} />
            <Row label="المدير" value={state.data.managerName} />
            <Row label="رقم الدور" value={`#${state.data.turn}`} />
            <Row label="موعد القبض" value={formatDate(state.data.payoutDate)} />
            <p className="text-xs text-muted-foreground text-center">
              بالمتابعة ستُضاف الجمعية إلى جهازك فورًا، ثم ستعرض باركود إتمام الانضمام على المدير ليُكمل التوثيق.
            </p>
            <Button onClick={confirmJoinMembership} className="w-full bg-gradient-primary shadow-glow">
              تأكيد الانضمام
            </Button>
          </Card>
        )}

        {state.kind === "member-join-complete" && (
          <Card className="card-elevated p-5 space-y-3 border-success/30">
            <CheckCircle2 className="size-12 text-success mx-auto" />
            <h3 className="font-bold text-center text-lg">تمت إضافة الجمعية على جهازك</h3>
            <p className="text-sm text-muted-foreground text-center">
              اعرض هذا الباركود على المدير الآن ليكتمل التوثيق ويظهر بجوار اسمك شارة التوثيق داخل الجمعية.
            </p>
            <div className="flex justify-center">
              <QRDisplay value={state.ackQr} size={220} />
            </div>
            <div className="rounded-xl bg-success/10 border border-success/30 p-3 text-center text-sm">
              دورك في الجمعية هو <span className="font-bold num-en">#{state.turn}</span>
            </div>
            <Button onClick={() => navigate(`/associations/${state.assocId}`)} variant="outline" className="w-full">
              فتح الجمعية
            </Button>
          </Card>
        )}

        {state.kind === "deep-confirm" && (
          <Card className="card-elevated p-5 space-y-3 border-success/30 text-center">
            <ShieldCheck className="size-12 text-success mx-auto" />
            <h3 className="font-bold text-lg">تم التحقق من الجهاز</h3>
            <p className="text-sm text-muted-foreground">
              أضِف العضو <span className="font-bold text-foreground">{state.pendingMember.name}</span> إلى الدور
              <span className="num-en mx-1">#{state.pendingMember.turn}</span> ثم اعرض له QR التالي ليؤكد الانضمام من جهازه.
            </p>
            <div className="flex justify-center">
              <QRDisplay value={state.joinInviteQr} size={220} />
            </div>
            <p className="text-xs text-warning">
              صالح لمدة ٥ دقائق فقط. بعد أن يؤكد العضو من جهازه، اضغط الزر التالي وامسح باركود الإتمام منه.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <Button onClick={() => setState({ kind: "scanning" })} className="w-full bg-gradient-primary shadow-glow">
                <ScanLine className="size-4 me-2" />
                مسح باركود إتمام الانضمام
              </Button>
              <Button
                onClick={() => {
                  clearJoinSession();
                  navigate(`/associations/${state.assoc.id}`);
                }}
                variant="outline"
                className="w-full"
              >
                إلغاء الجلسة
              </Button>
            </div>
          </Card>
        )}

        {state.kind === "manager-join-complete" && (
          <Card className="card-elevated p-5 space-y-3 border-success/30 text-center">
            <CheckCircle2 className="size-12 text-success mx-auto" />
            <h3 className="font-bold text-lg">اكتمل الانضمام بنجاح</h3>
            <p className="text-sm text-muted-foreground">
              أصبح <span className="font-bold text-foreground">{state.member.name}</span> عضوًا موثقًا في
              <span className="font-bold text-foreground mx-1">{state.assoc.name}</span>
            </p>
            <div className="rounded-xl bg-success/10 border border-success/30 p-3 flex items-center justify-center gap-2">
              <span className="font-semibold">{state.member.name}</span>
              <VerifiedBadge verified size="md" />
            </div>
            <Button onClick={() => navigate(`/associations/${state.assoc.id}`)} className="w-full bg-gradient-primary shadow-glow">
              العودة إلى الجمعية
            </Button>
          </Card>
        )}

        {state.kind === "manager-transfer-complete" && (
          <Card className="card-elevated p-5 space-y-3 border-success/30 text-center">
            <CheckCircle2 className="size-12 text-success mx-auto" />
            <h3 className="font-bold text-lg">اكتمل نقل الملكية</h3>
            <p className="text-sm text-muted-foreground">
              أصبح <span className="font-bold text-foreground">{state.newManagerName}</span> المدير الجديد لجمعية
              <span className="font-bold text-foreground mx-1">{state.assoc.name}</span>
            </p>
            <Button onClick={() => navigate(`/associations/${state.assoc.id}`)} className="w-full bg-gradient-primary shadow-glow">
              العودة إلى الجمعية
            </Button>
          </Card>
        )}

        {state.kind === "payment" && (
          <Card className="card-elevated p-5 space-y-3 border-primary/30">
            {approvalQr ? (
              <div className="flex flex-col items-center gap-3 animate-scale-in">
                <CheckCircle2 className="size-10 text-success" />
                <h3 className="font-bold">تمت الموافقة. اعرض هذا الباركود للعضو</h3>
                <QRDisplay value={approvalQr} />
                <p className="text-xs text-muted-foreground text-center">
                  باركود تأكيد لمرة واحدة. لن يصلح بعد المسح.
                </p>
                <Button onClick={() => navigate("/history")} variant="outline" className="w-full">
                  انتهيت
                </Button>
              </div>
            ) : (
              <>
                <h3 className="font-bold text-lg">
                  {state.data.kind === "payout" ? "طلب قبض دور" : "طلب سداد قسط"}
                </h3>
                <div className="flex items-center gap-2">
                  <Row label="العضو" value={state.data.name} />
                  <VerifiedBadge verified={state.member.verified} manual={state.member.isManual} />
                </div>
                <Row label="الجمعية" value={state.assoc.name} />
                <Row label="المبلغ" value={`${formatAmount(state.data.amount)} جنيه`} />
                <Row label="الدور" value={`#${state.data.turn}`} />
                <Row label="الوقت" value={formatDateTime(state.data.ts)} />
                <Button onClick={approvePayment} className="w-full bg-gradient-primary shadow-glow mt-2">
                  موافقة على {state.data.kind === "payout" ? "تسليم الدور" : "الدفع"}
                </Button>
              </>
            )}
          </Card>
        )}

        {state.kind === "approval" && (
          <Card className="card-elevated p-5 space-y-3 border-success/30">
            <CheckCircle2 className="size-10 text-success mx-auto" />
            <h3 className="font-bold text-center text-lg">
              إيصال تأكيد {state.data.kind === "payout" ? "قبض الدور" : "الدفع"}
            </h3>
            <Row label="المبلغ" value={`${formatAmount(state.data.amount)} جنيه`} />
            <Row label="المدير" value={state.data.managerName} />
            <Row label="رقم العملية" value={state.data.txId.slice(0, 8).toUpperCase()} />
            <Row label="التاريخ" value={formatDateTime(state.data.ts)} />
            <Button onClick={confirmReceipt} className="w-full bg-gradient-primary shadow-glow mt-2">
              تأكيد الاستلام وحفظ في السجل
            </Button>
          </Card>
        )}

        {state.kind === "history" && (
          <Card className="card-elevated p-5 space-y-3 border-primary/30">
            <h3 className="font-bold text-lg">تقرير شامل عن {state.data.name}</h3>
            <p className="text-xs text-muted-foreground">
              عدد العمليات: <span className="num-en">{state.data.txs.length}</span>
            </p>
            <div className="space-y-2 max-h-80 overflow-auto">
              {state.data.txs.map((tx) => (
                <div key={tx.id} className="rounded-lg bg-background/50 p-3 text-sm">
                  <p className="font-semibold">
                    {tx.aid.slice(0, 6)} · دور #<span className="num-en">{tx.turn}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="num-en">{formatAmount(tx.amount)}</span> جنيه · {formatDateTime(tx.date)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {state.kind === "transfer" && <TransferAcceptCard data={state.data} navigate={navigate} />}

        {state.kind === "idle" && (
          <Card className="p-5 text-center">
            <AlertTriangle className="size-8 text-warning mx-auto mb-2" />
            <p>لم يتم التعرف على الباركود</p>
          </Card>
        )}
      </div>

      <Dialog open={assocPickerOpen} onOpenChange={setAssocPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              إضافة العضو {state.kind === "identity" ? state.qr.name : ""}
              {state.kind === "identity" && <VerifiedBadge verified />}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">الجمعية</label>
              <Select value={pickedAssocId} onValueChange={setPickedAssocId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {myAssocs.map((assoc) => (
                    <SelectItem key={assoc.id} value={assoc.id}>
                      {assoc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">الدور المتاح</label>
              {vacantSlots.length === 0 ? (
                <p className="text-xs text-destructive">لا توجد أدوار شاغرة في هذه الجمعية</p>
              ) : (
                <Select value={memberTurn} onValueChange={setMemberTurn}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر دورًا" />
                  </SelectTrigger>
                  <SelectContent>
                    {vacantSlots.map((slot) => (
                      <SelectItem key={slot} value={String(slot)}>
                        دور #{slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              بعد اختيار الدور سيُطلب منك مسح باركود التأكيد العميق، ثم عرض QR جلسة الانضمام على العضو ليؤكد من جهازه.
            </p>

            <Button
              onClick={startAddMember}
              disabled={!memberTurn || !pickedAssocId}
              className="w-full bg-gradient-primary"
            >
              بدء إضافة العضو
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-border/40 last:border-0 py-1.5 gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-end">{value}</span>
    </div>
  );
}

function TransferAcceptCard({ data, navigate }: { data: TransferQr; navigate: ReturnType<typeof useNavigate> }) {
  const { identity } = useIdentity();
  const [accepting, setAccepting] = useState(false);
  const [ackQr, setAckQr] = useState<string | null>(null);

  const accept = async () => {
    if (!identity) return;
    if (data.toMemberId !== identity.publicId) {
      toast({ title: "هذا النقل ليس موجهًا إليك", variant: "destructive" });
      return;
    }

    setAccepting(true);
    const assoc = await db.associations.get(data.aid);
    if (!assoc) {
      toast({ title: "الجمعية غير موجودة لديك", variant: "destructive" });
      setAccepting(false);
      return;
    }

    const valid = assoc.managerHmac ? await verifyTransfer(assoc.managerHmac, data) : false;
    if (!valid) {
      toast({ title: "عرض نقل الملكية غير صحيح", variant: "destructive" });
      setAccepting(false);
      return;
    }

    await db.associations.update(data.aid, {
      role: "manager",
      managerId: identity.publicId,
      managerName: identity.name,
      managerHmac: identity.hmacSecret,
      originalCreatorId: data.originalCreatorId ?? assoc.originalCreatorId ?? data.fromManagerId,
      originalCreatorName: data.originalCreatorName ?? assoc.originalCreatorName ?? data.fromManagerName,
      originalCreatorUid: data.originalCreatorUid ?? assoc.originalCreatorUid ?? data.fromManagerUid,
      originalCreatorQr: data.originalCreatorQr ?? assoc.originalCreatorQr,
      transferredAt: Date.now(),
    });

    await db.transactions.add({
      id: uuid(),
      associationId: data.aid,
      associationName: data.aname,
      memberPublicId: identity.publicId,
      memberName: identity.name,
      managerPublicId: data.fromManagerId,
      managerName: data.fromManagerName,
      amount: 0,
      turn: assoc.myTurn ?? 0,
      kind: "transfer",
      status: "confirmed",
      createdAt: Date.now(),
      approvedAt: data.ts,
      confirmedAt: Date.now(),
      signature: data.sig,
      side: "member",
    });

    const ackBase = {
      aid: data.aid,
      aname: data.aname,
      fromManagerId: data.fromManagerId,
      toManagerId: identity.publicId,
      toManagerName: identity.name,
      toManagerUid: identity.deviceUid,
      ts: Date.now(),
    };
    const ackPayload: TransferAckQr = {
      t: "transfer-ack",
      ...ackBase,
      sig: await signTransferAck(identity.hmacSecret, ackBase),
    };

    await logSecurity("transfer", `قبول ملكية ${data.aname}`);
    toast({ title: `أصبحت مديرًا لـ ${data.aname}`, description: "اعرض باركود الإتمام على المدير القديم" });
    setAckQr(encodeQr(ackPayload));
    setAccepting(false);
  };

  return (
    <Card className="card-elevated p-5 space-y-3 border-warning/40">
      <Crown className="size-12 text-warning mx-auto" />
      <h3 className="font-bold text-center text-lg">عرض نقل ملكية الجمعية</h3>
      <Row label="الجمعية" value={data.aname} />
      <Row label="من" value={data.fromManagerName} />
      <Row label="إلى" value={data.toMemberName} />
      {ackQr ? (
        <>
          <p className="text-xs text-muted-foreground text-center">
            أصبحت المدير الجديد. اعرض هذا الباركود على المدير السابق ليُكمل تحديث جهازه.
          </p>
          <div className="flex justify-center">
            <QRDisplay value={ackQr} size={220} />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Button onClick={() => navigate(`/associations/${data.aid}`)} className="w-full bg-gradient-primary shadow-glow">
              فتح الجمعية
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground text-center">
            بقبولك ستصبح المدير الجديد بكامل الصلاحيات، ثم ستعرض باركود إتمام على المدير الحالي.
          </p>
          <Button onClick={accept} disabled={accepting} className="w-full bg-gradient-primary shadow-glow">
            {accepting ? (
              <>
                <RefreshCw className="size-4 me-2 animate-spin" />
                جارٍ القبول...
              </>
            ) : (
              <>
                <ArrowRightLeft className="size-4 me-2" />
                قبول الملكية
              </>
            )}
          </Button>
        </>
      )}
    </Card>
  );
}
