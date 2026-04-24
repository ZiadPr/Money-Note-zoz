import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Timer, CreditCard, QrCode, MessageSquare, Copy, Share2, RotateCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QRDisplay } from "@/components/QRDisplay";
import { db, type Association } from "@/lib/db";
import { useIdentity } from "@/hooks/useIdentity";
import { encodeQr, signPayment, PAYMENT_WINDOW_MS, type PaymentQr } from "@/lib/qr-payload";
import { createPaymentCode } from "@/lib/text-codes";
import { formatAmount } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function PayInstallment() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const isPayoutMode = search.get("kind") === "payout";
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const [assoc, setAssoc] = useState<Association | null>(null);
  const [amount, setAmount] = useState("");
  const [turn, setTurn] = useState("1");
  const [qrData, setQrData] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // الكود النصي
  const [textCode, setTextCode] = useState<string | null>(null);
  const [textExp, setTextExp] = useState<number>(0);
  const [creatingCode, setCreatingCode] = useState(false);

  useEffect(() => {
    if (!id) return;
    db.associations.get(id).then((a) => {
      if (a) {
        setAssoc(a);
        setAmount(String(a.installmentAmount));
        if (a.myTurn) setTurn(String(a.myTurn));
      }
    });
  }, [id]);

  // مولّد QR كل 10 ثوانٍ
  useEffect(() => {
    if (!assoc || !identity || !amount) return;
    let mounted = true;

    const generate = async () => {
      const ts = Date.now();
      const base = {
        aid: assoc.id,
        pid: identity.publicId,
        name: identity.name,
        amount: Number(amount),
        turn: Number(turn),
        kind: (isPayoutMode ? "payout" : "installment") as "installment" | "payout",
        ts,
      };
      const sig = await signPayment(identity.hmacSecret, base);
      const payload: PaymentQr = { t: "payment", ...base, sig };
      if (!mounted) return;
      setQrData(encodeQr(payload));
      setNow(ts);
    };

    generate();
    const t = setInterval(generate, PAYMENT_WINDOW_MS);
    return () => { mounted = false; clearInterval(t); };
  }, [assoc, identity, amount, turn, isPayoutMode]);

  // عدّاد ثانية بثانية
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, []);

  const remaining = useMemo(() => {
    const left = PAYMENT_WINDOW_MS - (Date.now() - now);
    return Math.max(0, Math.ceil(left / 1000));
  }, [now]);

  const textRemaining = useMemo(() => {
    if (!textExp) return 0;
    return Math.max(0, Math.ceil((textExp - Date.now()) / 1000));
  }, [textExp]);

  const generateTextCode = async () => {
    if (!assoc || !identity || !amount) return;
    setCreatingCode(true);
    try {
      const r = await createPaymentCode({
        hmacSecret: identity.hmacSecret,
        aid: assoc.id,
        aname: assoc.name,
        pid: identity.publicId,
        pname: identity.name,
        amount: Number(amount),
        turn: Number(turn),
        txKind: isPayoutMode ? "payout" : "installment",
      });
      setTextCode(r.text);
      setTextExp(r.expiresAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذّر الإنشاء";
      toast({ title: message, variant: "destructive" });
    } finally {
      setCreatingCode(false);
    }
  };

  const copyCode = () => {
    if (!textCode) return;
    navigator.clipboard?.writeText(textCode);
    toast({ title: "تم نسخ الكود" });
  };

  const shareCode = async () => {
    if (!textCode) return;
    const text = `كود ${isPayoutMode ? "قبض دور" : "سداد قسط"} موني نوت\n${textCode}\n\nصالح حتى ${new Date(textExp).toLocaleTimeString("ar-EG")}`;
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

  if (!assoc || !identity) {
    return (
      <AppShell hideNav>
        <AppHeader title={isPayoutMode ? "قبض الدور" : "سداد القسط"} back />
      </AppShell>
    );
  }

  const titleText = isPayoutMode ? "قبض دور الجمعية" : "سداد القسط";

  return (
    <AppShell hideNav>
      <AppHeader title={titleText} subtitle={assoc.name} back />

      <div className="p-4 space-y-4 animate-fade-in">
        <Card className="card-elevated p-4 space-y-3 border-border/50">
          <div className="space-y-1.5">
            <Label className="text-xs">المبلغ (جنيه)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-background/50 num-en text-lg h-12 font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">رقم الدور</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={turn}
              onChange={(e) => setTurn(e.target.value)}
              className="bg-background/50 num-en"
            />
          </div>
        </Card>

        <Tabs defaultValue="qr" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="qr"><QrCode className="size-4 me-1.5" /> باركود قريب</TabsTrigger>
            <TabsTrigger value="text"><MessageSquare className="size-4 me-1.5" /> كود عن بُعد</TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="mt-4">
            {qrData && Number(amount) > 0 && (
              <Card className="card-elevated p-5 flex flex-col items-center gap-4 border-primary/30 animate-scale-in">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">باركود {isPayoutMode ? "قبض الدور" : "الدفع"} الديناميكي</p>
                  <p className="text-2xl font-extrabold gradient-text mt-1">
                    <span className="num-en">{formatAmount(Number(amount))}</span>
                    <span className="text-sm text-muted-foreground font-normal me-2">جنيه</span>
                  </p>
                </div>

                <QRDisplay value={qrData} size={220} />

                <div className="flex items-center gap-2 text-sm">
                  <Timer className={`size-4 ${remaining <= 3 ? "text-destructive animate-pulse" : "text-primary"}`} />
                  <span className="text-muted-foreground">يتجدد خلال:</span>
                  <span className={`font-bold num-en ${remaining <= 3 ? "text-destructive" : ""}`}>{remaining}</span>
                  <span className="text-muted-foreground">ث</span>
                </div>

                <p className="text-[11px] text-muted-foreground text-center">
                  اطلب من المدير مسح الباركود الآن. سيتغيّر الباركود تلقائيًا كل ١٠ ثوانٍ لحمايتك.
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="text" className="mt-4">
            <Card className="card-elevated p-5 space-y-3 border-primary/30">
              {!textCode || textRemaining === 0 ? (
                <div className="text-center space-y-3">
                  <MessageSquare className="size-10 text-primary mx-auto" />
                  <h3 className="font-bold">إنشاء كود {isPayoutMode ? "قبض" : "سداد"} عن بُعد</h3>
                  <p className="text-xs text-muted-foreground">
                    سيتولد كود نصي صالح لـ ٢ دقيقة فقط، يمكنك إرساله للمدير عبر واتساب أو رسالة.
                  </p>
                  {textCode && textRemaining === 0 && (
                    <p className="text-xs text-destructive">انتهت صلاحية الكود السابق — أنشئ كودًا جديدًا</p>
                  )}
                  <Button
                    onClick={generateTextCode}
                    disabled={creatingCode || !amount}
                    className="w-full bg-gradient-primary shadow-glow"
                  >
                    {creatingCode ? "جارٍ الإنشاء..." : "إنشاء كود الدفع"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 animate-scale-in">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">كود الدفع</p>
                    <div className="rounded-xl bg-background/80 border border-primary/30 p-4 break-all text-sm font-mono num-en select-all">
                      {textCode}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Timer className={`size-4 ${textRemaining <= 20 ? "text-destructive animate-pulse" : "text-primary"}`} />
                    <span className="text-muted-foreground">يبقى:</span>
                    <span className={`font-bold num-en ${textRemaining <= 20 ? "text-destructive" : ""}`}>{textRemaining}</span>
                    <span className="text-muted-foreground">ث</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={copyCode} variant="outline">
                      <Copy className="size-4 me-1.5" /> نسخ
                    </Button>
                    <Button onClick={shareCode} className="bg-gradient-primary">
                      <Share2 className="size-4 me-1.5" /> مشاركة
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setTextCode(null); setTextExp(0); }}
                    className="w-full text-xs text-muted-foreground"
                  >
                    <RotateCw className="size-3 me-1.5" /> إنشاء كود جديد
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    عند الاستلام سيرسل لك المدير كود تأكيد صالحًا لـ ٥ ساعات. أدخله في "تأكيد عملية معلقة" لإتمام العملية.
                  </p>
                </div>
              )}
            </Card>

            <Button
              variant="outline"
              onClick={() => navigate("/confirm-code")}
              className="w-full mt-3 border-success/30 text-success hover:bg-success/10"
            >
              لديك كود تأكيد؟ أدخله هنا
            </Button>
          </TabsContent>
        </Tabs>

        <Button variant="outline" onClick={() => navigate(-1)} className="w-full">
          <CreditCard className="size-4 me-2" />
          إلغاء العملية
        </Button>
      </div>
    </AppShell>
  );
}
