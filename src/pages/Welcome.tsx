import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, ShieldCheck, ScanLine, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createIdentity } from "@/lib/identity";
import { notifyIdentityChanged } from "@/hooks/useIdentity";
import { toast } from "@/hooks/use-toast";

export default function Welcome() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast({ title: "أدخل اسمًا صحيحًا", description: "حرفان على الأقل", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await createIdentity(trimmed);
      notifyIdentityChanged();
      toast({ title: `أهلًا بك يا ${trimmed}`, description: "تم إنشاء هويتك الرقمية محليًا" });
      navigate("/", { replace: true });
    } catch (e) {
      console.error(e);
      toast({ title: "حدث خطأ", description: String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 max-w-lg mx-auto">
      <div className="w-full animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex size-20 items-center justify-center rounded-3xl bg-gradient-primary shadow-glow mb-4 animate-pulse-glow">
            <Wallet className="size-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-extrabold gradient-text mb-2">موني نوت</h1>
          <p className="text-muted-foreground text-sm">الجمعية في جيبك، أمانًا بلا إنترنت</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-8">
          {[
            { icon: WifiOff, t: "أوفلاين تمامًا" },
            { icon: ShieldCheck, t: "تشفير محلي" },
            { icon: ScanLine, t: "QR ديناميكي" },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-border/50 bg-card/50 p-3 text-center">
              <f.icon className="size-5 text-primary mx-auto mb-1" />
              <p className="text-[11px] text-muted-foreground leading-tight">{f.t}</p>
            </div>
          ))}
        </div>

        <Card className="card-elevated p-6 border-border/50">
          <label className="block text-sm font-semibold mb-2">أدخل اسمك للبدء</label>
          <p className="text-xs text-muted-foreground mb-4">سيتم إنشاء هويتك الرقمية محليًا على هذا الجهاز فقط، بدون أي حساب أو سيرفر.</p>
          <Input
            placeholder="مثال: أحمد محمد"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="h-12 text-base mb-4 bg-background/50"
            autoFocus
          />
          <Button onClick={submit} disabled={submitting} className="w-full h-12 bg-gradient-primary hover:opacity-90 shadow-glow text-base font-bold">
            {submitting ? "جارٍ الإنشاء..." : "إنشاء هويتي الرقمية"}
          </Button>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          بمتابعتك تقبل أن جميع البيانات ستبقى محفوظة على جهازك فقط
        </p>
      </div>
    </div>
  );
}
