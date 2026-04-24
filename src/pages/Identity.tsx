import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Copy, Cpu, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIdentity } from "@/hooks/useIdentity";
import { useIdentityVerification } from "@/hooks/useIdentityVerification";
import { QRDisplay } from "@/components/QRDisplay";
import { encodeQr, type IdentityQr } from "@/lib/qr-payload";
import { shortId } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export default function Identity() {
  const { identity } = useIdentity();
  const { verified: identityVerified } = useIdentityVerification(identity?.publicId);

  if (!identity) {
    return (
      <AppShell>
        <AppHeader title="هويتي" />
      </AppShell>
    );
  }

  const qr: IdentityQr = {
    t: "identity",
    pid: identity.publicId,
    name: identity.name,
    uid: identity.deviceUid,
    hmac: identity.hmacSecret,
  };

  const copyId = () => {
    navigator.clipboard?.writeText(identity.publicId);
    toast({ title: "تم نسخ المعرّف" });
  };

  const copyUid = () => {
    navigator.clipboard?.writeText(identity.deviceUid);
    toast({ title: "تم نسخ UID الجهاز" });
  };

  return (
    <AppShell>
      <AppHeader title="بطاقتي الرقمية" subtitle="هويتك المحلية على هذا الجهاز" />

      <div className="p-4 animate-fade-in space-y-4">
        <Card className="card-elevated p-6 border-primary/30 relative overflow-hidden">
          <div className="absolute -top-16 -end-16 size-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-12 -start-12 size-32 rounded-full bg-accent/10 blur-3xl" />

          <div className="relative flex flex-col items-center gap-4 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-success/15 border border-success/30 px-3 py-1 text-xs font-semibold text-success">
              <ShieldCheck className="size-3" />
              هوية محلية مشفّرة
            </div>

            <div>
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-extrabold">{identity.name}</h2>
                <VerifiedBadge verified={identityVerified} size="md" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                الحالة: {identityVerified ? "موثّق" : "غير موثّق بعد"}
              </p>
              <button onClick={copyId} className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1 hover:text-primary">
                <span className="num-en">{shortId(identity.publicId)}</span>
                <Copy className="size-3" />
              </button>
            </div>

            <QRDisplay value={encodeQr(qr)} size={220} />

            <p className="text-xs text-muted-foreground max-w-xs">
              اعرض هذا الباركود للمدير لينضمّك إلى جمعيته. هذا الباركود ثابت ويمثل هويتك في موني نوت.
            </p>
          </div>
        </Card>

        <Card className="p-4 border-border/50">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Cpu className="size-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">UID الجهاز (ثابت)</p>
              <button onClick={copyUid} className="font-bold num-en text-sm flex items-center gap-1.5 hover:text-primary truncate w-full text-start">
                {identity.deviceUid}
                <Copy className="size-3 shrink-0" />
              </button>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border/50">
          <h3 className="font-bold text-sm mb-2">كيف يعمل؟</h3>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc ms-4">
            <li>كل البيانات محفوظة على جهازك فقط</li>
            <li>لا يوجد سيرفر ولا حسابات إنترنت</li>
            <li>كل عملية موقّعة رقميًا بـ HMAC-SHA256</li>
            <li>باركود الدفع يتجدد كل ١٠ ثوانٍ لمنع التكرار</li>
            <li>الـ UID مشتق من جهازك ولا يتغير</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
