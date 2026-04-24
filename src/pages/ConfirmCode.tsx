// إدخال كود تأكيد الدفع (العضو يستخدمه لتأكيد قبول التأكيد من المدير)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, KeyRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decodeTextCode, verifyCodePayload, markCodeUsed, type ApprovalCodePayload } from "@/lib/text-codes";
import { db, type Transaction } from "@/lib/db";
import { useIdentity } from "@/hooks/useIdentity";
import { formatAmount, formatDateTime } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function ConfirmCode() {
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ApprovalCodePayload | null>(null);
  const [parsedSig, setParsedSig] = useState<string>("");
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    setVerifying(true);
    try {
      const dec = decodeTextCode(text.trim());
      if (!dec || dec.p.kind !== "approval") {
        toast({ title: "كود غير صالح", variant: "destructive" });
        return;
      }
      if (Date.now() > dec.p.exp) {
        toast({ title: "انتهت صلاحية الكود", description: "تواصل مع المدير", variant: "destructive" });
        return;
      }
      const used = await db.pendingOps.get(dec.p.code);
      if (used?.used) {
        toast({ title: "هذا الكود استُخدم مسبقًا", variant: "destructive" });
        return;
      }
      // التحقق من توقيع المدير عبر managerHmac المخزّن في الجمعية
      const a = await db.associations.get(dec.p.aid);
      if (a?.managerHmac) {
        const ok = await verifyCodePayload(a.managerHmac, dec.p, dec.sig);
        if (!ok) {
          toast({ title: "توقيع الكود غير صحيح", variant: "destructive" });
          return;
        }
      }
      setParsed(dec.p);
      setParsedSig(dec.sig);
    } finally {
      setVerifying(false);
    }
  };

  const confirm = async () => {
    if (!parsed || !identity) return;
    const exists = await db.transactions.get(parsed.txId);
    if (exists) {
      toast({ title: "تم تأكيد هذه العملية مسبقًا" });
      navigate("/history");
      return;
    }
    const tx: Transaction = {
      id: parsed.txId,
      associationId: parsed.aid,
      associationName: parsed.aname,
      memberPublicId: parsed.pid,
      memberName: identity.name,
      managerPublicId: parsed.managerId,
      managerName: parsed.managerName,
      amount: parsed.amount,
      turn: parsed.turn,
      kind: parsed.txKind,
      status: "confirmed",
      createdAt: Date.now(),
      approvedAt: parsed.ts,
      confirmedAt: Date.now(),
      signature: parsedSig,
      side: "member",
    };
    await db.transactions.add(tx);
    await markCodeUsed(parsed.code);

    // إن كانت قبض دور — حدّث جمعيتي
    if (parsed.txKind === "payout") {
      await db.associations.update(parsed.aid, { payoutCollected: true, payoutCollectedAt: Date.now() });
    }

    toast({ title: "تم تأكيد الاستلام", description: "سُجِّلت العملية في سجلك" });
    navigate("/history");
  };

  return (
    <AppShell hideNav>
      <AppHeader title="تأكيد عملية معلقة" back />

      <div className="p-4 space-y-4 animate-fade-in">
        {!parsed ? (
          <Card className="card-elevated p-5 space-y-3 border-primary/30">
            <div className="text-center">
              <KeyRound className="size-10 text-primary mx-auto mb-2" />
              <h3 className="font-bold">أدخل كود التأكيد</h3>
              <p className="text-xs text-muted-foreground mt-1">
                الكود الذي أرسله لك المدير بعد موافقته على عمليتك.
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
          <Card className="card-elevated p-5 space-y-3 border-success/30 animate-scale-in">
            <CheckCircle2 className="size-12 text-success mx-auto" />
            <h3 className="font-bold text-center text-lg">
              إيصال {parsed.txKind === "payout" ? "قبض الدور" : "تأكيد الدفع"}
            </h3>
            <Row label="الجمعية" value={parsed.aname} />
            <Row label="المبلغ" value={`${formatAmount(parsed.amount)} جنيه`} />
            <Row label="الدور" value={`#${parsed.turn}`} />
            <Row label="المدير" value={parsed.managerName} />
            <Row label="رقم العملية" value={parsed.txId.slice(0, 8).toUpperCase()} />
            <Row label="التاريخ" value={formatDateTime(parsed.ts)} />
            <Button onClick={confirm} className="w-full bg-gradient-primary shadow-glow">
              تأكيد الاستلام وحفظ في السجل
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
