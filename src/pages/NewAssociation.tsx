import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db, type Association, type CycleType } from "@/lib/db";
import { uuid } from "@/lib/crypto";
import { useIdentity } from "@/hooks/useIdentity";
import { toast } from "@/hooks/use-toast";
import { encodeQr, type IdentityQr } from "@/lib/qr-payload";

export default function NewAssociation() {
  const { identity } = useIdentity();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState("");
  const [cycle, setCycle] = useState<CycleType>("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!identity) return;
    if (!name.trim() || !amount || !count) {
      toast({ title: "أكمل جميع الحقول", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const creatorQr: IdentityQr = {
        t: "identity",
        pid: identity.publicId,
        name: identity.name,
        uid: identity.deviceUid,
        hmac: identity.hmacSecret,
      };
      const a: Association = {
        id: uuid(),
        name: name.trim(),
        installmentAmount: Number(amount),
        membersCount: Number(count),
        cycleType: cycle,
        startDate: new Date(startDate).getTime(),
        role: "manager",
        managerId: identity.publicId,
        managerName: identity.name,
        managerHmac: identity.hmacSecret,
        originalCreatorId: identity.publicId,
        originalCreatorName: identity.name,
        originalCreatorUid: identity.deviceUid,
        originalCreatorQr: encodeQr(creatorQr),
        createdAt: Date.now(),
      };
      await db.associations.add(a);
      toast({ title: "تم إنشاء الجمعية", description: "اعرض الباركود ليبدأ الأعضاء بالانضمام" });
      navigate(`/associations/${a.id}`, { replace: true });
    } catch (e) {
      toast({ title: "خطأ", description: String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell hideNav>
      <AppHeader title="إنشاء جمعية جديدة" back />
      <div className="p-4 animate-fade-in">
        <Card className="card-elevated p-5 space-y-4 border-border/50">
          <Field label="اسم الجمعية">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: جمعية العائلة" className="bg-background/50" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="قيمة القسط">
              <Input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
                className="bg-background/50 num-en"
              />
            </Field>
            <Field label="عدد الأعضاء">
              <Input
                type="number"
                inputMode="numeric"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="10"
                className="bg-background/50 num-en"
              />
            </Field>
          </div>

          <Field label="نوع الدورة">
            <Select value={cycle} onValueChange={(v) => setCycle(v as CycleType)}>
              <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">شهرية</SelectItem>
                <SelectItem value="weekly">أسبوعية</SelectItem>
                <SelectItem value="custom">مخصصة</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="تاريخ البدء">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-background/50" />
          </Field>

          <Button
            onClick={submit}
            disabled={submitting}
            className="w-full h-12 bg-gradient-primary shadow-glow text-base font-bold"
          >
            {submitting ? "جارٍ الإنشاء..." : "إنشاء الجمعية"}
          </Button>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-4">
          بعد الإنشاء سيتم توليد QR الجمعية لمشاركته مع الأعضاء.
        </p>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}
