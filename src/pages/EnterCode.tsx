// إدخال كود دفع من العضو (يستخدمه المدير) ثم إصدار كود تأكيد
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, KeyRound, Copy, Share2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import {
  decodeTextCode, verifyCodePayload, markCodeUsed,
  createApprovalCode, type PaymentCodePayload,
} from "@/lib/text-codes";
import { db, type Transaction, type Member, type Association } from "@/lib/db";
import { uuid } from "@/lib/crypto";
import { useIdentity } from "@/hooks/useIdentity";
import { formatAmount, formatDateTime } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function EnterCode() {
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<PaymentCodePayload | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [assoc, setAssoc] = useState<Association | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [approvalCode, setApprovalCode] = useState<string | null>(null);
  const [approvalExp, setApprovalExp] = useState(0);

  const verify = async () => {
    setVerifying(true);
    try {
      const dec = decodeTextCode(text.trim());
      if (!dec || dec.p.kind !== "payment") {
        toast({ title: "كود غير صالح", variant: "destructive" });
        return;
      }
      if (Date.now() > dec.p.exp) {
        toast({ title: "الكود منتهٍ", description: "اطلب من العضو كودًا جديدًا", variant: "destructive" });
        return;
      }
      const used = await db.pendingOps.get(dec.p.code);
      if (used?.used) {
        toast({ title: "هذا الكود استُخدم مسبقًا", variant: "destructive" });
        return;
      }
      const m = await db.members.where("publicId").equals(dec.p.pid).first();
      const a = await db.associations.get(dec.p.aid);
      if (!m || !a) {
        toast({ title: "العضو/الجمعية غير معروفة", variant: "destructive" });
        return;
      }
      if (m.handshakeKey) {
        const ok = await verifyCodePayload(m.handshakeKey, dec.p, dec.sig);
        if (!ok) {
          toast({ title: "توقيع الكود غير صحيح", variant: "destructive" });
          return;
        }
      }
      setParsed(dec.p);
      setMember(m);
      setAssoc(a);
    } finally {
      setVerifying(false);
    }
  };

  const approve = async () => {
    if (!parsed || !member || !assoc || !identity) return;
    const txId = uuid();
    const tx: Transaction = {
      id: txId,
      associationId: assoc.id,
      associationName: assoc.name,
      memberId: member.id,
      memberPublicId: parsed.pid,
      memberName: parsed.pname,
      managerPublicId: identity.publicId,
      managerName: identity.name,
      amount: parsed.amount,
      turn: parsed.turn,
      kind: parsed.txKind,
      status: "approved",
      createdAt: Date.now(),
      approvedAt: Date.now(),
      side: "manager",
    };
    await db.transactions.add(tx);
    await markCodeUsed(parsed.code);

    if (parsed.txKind === "payout") {
      await db.members.update(member.id, { payoutCollected: true, payoutCollectedAt: Date.now() });
    }

    const r = await createApprovalCode({
      hmacSecret: identity.hmacSecret,
      txId,
      aid: assoc.id,
      aname: assoc.name,
      pid: parsed.pid,
      pname: parsed.pname,
      managerId: identity.publicId,
      managerName: identity.name,
      amount: parsed.amount,
      turn: parsed.turn,
      txKind: parsed.txKind,
    });
    setApprovalCode(r.text);
    setApprovalExp(r.expiresAt);
  };

  const copy = () => {
    if (!approvalCode) return;
    navigator.clipboard?.writeText(approvalCode);
    toast({ title: "تم نسخ كود التأكيد" });
  };

  const share = async () => {
    if (!approvalCode) return;
    const text = `كود تأكيد موني نوت\n${approvalCode}\n\nصالح لـ ٥ ساعات. أدخله في "تأكيد عملية معلقة".`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        navigator.clipboard?.writeText(text);
        toast({ title: "تم نسخ الرسالة" });
      }
    } catch {
      toast({ title: "تعذّرت المشاركة", variant: "destructive" });
    }
  };

  return (
    <AppShell hideNav>
      <AppHeader title="إدخال كود دفع" back />

      <div className="p-4 space-y-4 animate-fade-in">
        {approvalCode ? (
          <Card className="card-elevated p-5 space-y-3 border-success/30 animate-scale-in">
            <CheckCircle2 className="size-12 text-success mx-auto" />
            <h3 className="font-bold text-center text-lg">كود التأكيد جاهز</h3>
            <p className="text-xs text-muted-foreground text-center">
              أرسل هذا الكود للعضو ليُكمل تأكيد العملية. صالح لـ ٥ ساعات.
            </p>
            <div className="rounded-xl bg-background/80 border border-success/30 p-4 break-all text-sm font-mono num-en select-all text-center">
              {approvalCode}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={copy} variant="outline">
                <Copy className="size-4 me-1.5" /> نسخ
              </Button>
              <Button onClick={share} className="bg-gradient-primary">
                <Share2 className="size-4 me-1.5" /> مشاركة
              </Button>
            </div>
            <Button onClick={() => navigate("/history")} variant="ghost" className="w-full">
              عرض السجل
            </Button>
          </Card>
        ) : !parsed ? (
          <Card className="card-elevated p-5 space-y-3 border-primary/30">
            <div className="text-center">
              <KeyRound className="size-10 text-primary mx-auto mb-2" />
              <h3 className="font-bold">إدخال كود دفع من العضو</h3>
              <p className="text-xs text-muted-foreground mt-1">
                الكود صالح لـ دقيقتين فقط من إنشائه.
              </p>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="MN-T1:..."
              rows={4}
              className="font-mono text-sm bg-background/50"
            />
            <Button onClick={verify} disabled={!text.trim() || verifying} className="w-full bg-gradient-primary">
              {verifying ? "جارٍ التحقق..." : "تحقق من الكود"}
            </Button>
          </Card>
        ) : (
          <Card className="card-elevated p-5 space-y-3 border-primary/30 animate-scale-in">
            <h3 className="font-bold text-lg">
              {parsed.txKind === "payout" ? "طلب قبض دور" : "طلب سداد قسط"}
            </h3>
            <div className="flex items-center gap-2">
              <Row label="العضو" value={parsed.pname} />
              {member && <VerifiedBadge verified={member.verified} manual={member.isManual} />}
            </div>
            <Row label="الجمعية" value={parsed.aname} />
            <Row label="المبلغ" value={`${formatAmount(parsed.amount)} جنيه`} />
            <Row label="الدور" value={`#${parsed.turn}`} />
            <Row label="الوقت" value={formatDateTime(parsed.ts)} />
            <Button onClick={approve} className="w-full bg-gradient-primary shadow-glow">
              موافقة وإصدار كود التأكيد
            </Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-border/40 last:border-0 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
