import { useCallback, useEffect, useState } from "react";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { logSecurity } from "@/lib/db";
import {
  getSecuritySettings,
  isAppLockRequired,
  lockAppSession,
  LOCK_CHANGED_EVENT,
  SECURITY_CHANGED_EVENT,
  unlockAppSession,
  verifyPin,
} from "@/lib/app-security";

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const syncState = useCallback(() => {
    const settings = getSecuritySettings();
    setPinEnabled(settings.pinEnabled);
    setLocked(isAppLockRequired());
    setLoading(false);
  }, []);

  useEffect(() => {
    syncState();

    const handleVisibilityChange = () => {
      const settings = getSecuritySettings();
      if (document.hidden && settings.pinEnabled && settings.lockOnBackground) {
        lockAppSession();
      }
    };

    window.addEventListener(SECURITY_CHANGED_EVENT, syncState);
    window.addEventListener(LOCK_CHANGED_EVENT, syncState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(SECURITY_CHANGED_EVENT, syncState);
      window.removeEventListener(LOCK_CHANGED_EVENT, syncState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncState]);

  const unlock = async () => {
    setSubmitting(true);
    setError("");

    const ok = await verifyPin(pin.trim());
    if (!ok) {
      setError("رمز PIN غير صحيح");
      await logSecurity("pin", "محاولة فتح فاشلة برمز PIN");
      setSubmitting(false);
      return;
    }

    unlockAppSession();
    await logSecurity("pin", "تم فتح التطبيق برمز PIN");
    setPin("");
    setSubmitting(false);
    syncState();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="size-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!pinEnabled || !locked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-background via-background to-primary/5">
      <Card className="w-full max-w-sm card-elevated p-6 border-primary/20">
        <div className="text-center space-y-4">
          <div className="inline-flex size-16 items-center justify-center rounded-3xl bg-gradient-primary shadow-glow">
            <LockKeyhole className="size-8 text-primary-foreground" />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold gradient-text">موني نوت</h1>
            <p className="text-sm text-muted-foreground mt-1">التطبيق مقفل محليًا حتى إدخال رمز PIN</p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-secondary/20 p-3 text-start">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-primary" />
              حماية محلية على هذا الجهاز
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              إذا نسيت الرمز ستحتاج إلى مسح بيانات التطبيق محليًا من الجهاز أو المتصفح.
            </p>
          </div>

          <div className="space-y-2 text-start">
            <label className="text-xs font-semibold flex items-center gap-1.5">
              <KeyRound className="size-3.5 text-primary" />
              رمز PIN
            </label>
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              maxLength={8}
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, "").slice(0, 8));
                if (error) setError("");
              }}
              onKeyDown={(event) => event.key === "Enter" && pin.trim().length >= 4 && unlock()}
              placeholder="أدخل الرمز"
              className="h-12 text-center text-lg tracking-[0.3em] num-en"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <Button
            onClick={unlock}
            disabled={submitting || pin.trim().length < 4}
            className="w-full h-12 bg-gradient-primary shadow-glow text-base font-bold"
          >
            {submitting ? "جارٍ التحقق" : "فتح التطبيق"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
