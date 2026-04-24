import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Plus,
  ScanLine,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { db, type Association, type PendingOp, type Transaction } from "@/lib/db";
import { useIdentity } from "@/hooks/useIdentity";
import { useIdentityVerification } from "@/hooks/useIdentityVerification";
import { formatAmount, formatDateTime } from "@/lib/format";

type PendingSummary =
  | {
      source: "transaction";
      id: string;
      title: string;
      subtitle: string;
      createdAt: number;
      variant: "pending" | "awaiting";
    }
  | {
      source: "code";
      id: string;
      title: string;
      subtitle: string;
      createdAt: number;
      variant: "pending" | "awaiting";
    };

export default function Home() {
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const { verified: identityVerified } = useIdentityVerification(identity?.publicId);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [allTx, setAllTx] = useState<Transaction[]>([]);
  const [pendingOps, setPendingOps] = useState<PendingOp[]>([]);

  useEffect(() => {
    const load = async () => {
      const [assocRows, txRows, pendingRows] = await Promise.all([
        db.associations.toArray(),
        db.transactions.orderBy("createdAt").reverse().toArray(),
        db.pendingOps.toArray(),
      ]);

      setAssociations(assocRows);
      setAllTx(txRows);
      setPendingOps(pendingRows.filter((item) => !item.used && item.expiresAt > Date.now()));
    };

    load();
  }, []);

  const metrics = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    return {
      activeAssociations: associations.length,
      paidThisMonth: allTx
        .filter((tx) => tx.status === "confirmed" && tx.createdAt >= monthStart.getTime())
        .reduce((sum, tx) => sum + tx.amount, 0),
      pendingCount:
        allTx.filter((tx) => tx.status === "approved" || tx.status === "pending").length + pendingOps.length,
    };
  }, [allTx, associations, pendingOps]);

  const latestPending = useMemo<PendingSummary | null>(() => {
    const latestPendingTx = allTx
      .filter((tx) => tx.status === "approved" || tx.status === "pending")
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    const latestCode = [...pendingOps].sort((a, b) => b.createdAt - a.createdAt)[0];

    const txCandidate = latestPendingTx
      ? {
          source: "transaction" as const,
          id: latestPendingTx.id,
          title: latestPendingTx.kind === "payout" ? "قبض دور بانتظار التأكيد" : "عملية بانتظار التأكيد",
          subtitle: `${latestPendingTx.associationName} · ${formatAmount(latestPendingTx.amount)} جنيه`,
          createdAt: latestPendingTx.createdAt,
          variant: latestPendingTx.status === "approved" ? "awaiting" : "pending",
        }
      : null;

    const codeCandidate = latestCode
      ? {
          source: "code" as const,
          id: latestCode.id,
          title: latestCode.kind === "approval-out" ? "كود تأكيد جاهز للإرسال" : "كود دفع نشط",
          subtitle: `${latestCode.associationName} · ينتهي ${formatDateTime(latestCode.expiresAt)}`,
          createdAt: latestCode.createdAt,
          variant: latestCode.kind === "approval-out" ? "awaiting" : "pending",
        }
      : null;

    return [txCandidate, codeCandidate]
      .filter(Boolean)
      .sort((a, b) => (b?.createdAt ?? 0) - (a?.createdAt ?? 0))[0] ?? null;
  }, [allTx, pendingOps]);

  const latestTransaction = allTx[0] ?? null;

  return (
    <AppShell>
      <AppHeader
        title={
          <span className="flex items-center gap-2">
            <span>{identity ? `أهلًا، ${identity.name}` : "موني نوت"}</span>
            {identity && <VerifiedBadge verified={identityVerified} size="md" />}
          </span>
        }
        subtitle="ملخص سريع لآخر نشاطك فقط"
      />

      <div className="p-4 space-y-4 animate-fade-in">
        <Card className="card-elevated p-5 border-primary/20 relative overflow-hidden">
          <div className="absolute -top-12 -end-12 size-32 rounded-full bg-primary/10 blur-2xl" />
          <p className="text-xs text-muted-foreground mb-1">ملخص اليوم</p>
          <h2 className="text-2xl font-extrabold gradient-text mb-4">موني نوت</h2>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="الجمعيات النشطة" value={String(metrics.activeAssociations)} icon={<Wallet className="size-4 text-primary" />} />
            <MetricCard label="مدفوع هذا الشهر" value={formatAmount(metrics.paidThisMonth)} icon={<CreditCard className="size-4 text-success" />} />
            <MetricCard label="عمليات معلقة" value={String(metrics.pendingCount)} icon={<AlertCircle className="size-4 text-warning" />} />
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => navigate("/scan")}
            className="h-auto py-4 flex-col gap-2 bg-gradient-primary hover:opacity-90 shadow-glow"
          >
            <ScanLine className="size-6" />
            <span className="text-sm font-bold">مسح QR</span>
          </Button>
          <Button
            onClick={() => navigate("/associations/new")}
            variant="outline"
            className="h-auto py-4 flex-col gap-2 border-primary/30 hover:bg-primary/10"
          >
            <Plus className="size-6 text-primary" />
            <span className="text-sm font-bold">إنشاء جمعية</span>
          </Button>
        </div>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <AlertCircle className="size-4 text-warning" />
              الإشعارات والمعلقة
            </h2>
            <button onClick={() => navigate("/notifications")} className="text-xs text-primary">
              عرض الصفحة
            </button>
          </div>

          <SummaryCard
            title={latestPending ? latestPending.title : "لا توجد عناصر معلقة"}
            subtitle={
              latestPending
                ? latestPending.subtitle
                : "أي دفعات أو أكواد نشطة ستظهر هنا داخل صفحة الإشعارات والمعلقة."
            }
            meta={latestPending ? formatDateTime(latestPending.createdAt) : "اضغط لفتح صفحة الإشعارات والمعلقة"}
            badge={latestPending ? <StatusBadge variant={latestPending.variant} /> : <StatusBadge variant="verified" label="صافي" />}
            onClick={() => navigate("/notifications")}
          />
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              آخر عملية
            </h2>
            <button onClick={() => navigate("/history")} className="text-xs text-primary">
              السجل الكامل
            </button>
          </div>

          <SummaryCard
            title={latestTransaction ? latestTransaction.associationName : "لا توجد عمليات بعد"}
            subtitle={
              latestTransaction
                ? `${latestTransaction.kind === "payout" ? "قبض دور" : latestTransaction.kind === "join" ? "انضمام" : latestTransaction.kind === "transfer" ? "نقل ملكية" : "سداد"} · ${formatAmount(latestTransaction.amount)} جنيه`
                : "عند تسجيل أول عملية ستظهر هنا كملخص مضغوط."
            }
            meta={latestTransaction ? formatDateTime(latestTransaction.createdAt) : "اضغط لفتح سجل العمليات"}
            badge={
              latestTransaction ? (
                <StatusBadge
                  variant={
                    latestTransaction.status === "confirmed"
                      ? "verified"
                      : latestTransaction.status === "approved"
                        ? "awaiting"
                        : latestTransaction.status === "cancelled"
                          ? "failed"
                          : "pending"
                  }
                />
              ) : (
                <StatusBadge variant="pending" label="فارغ" />
              )
            }
            onClick={() => navigate("/history")}
          />
        </section>
      </div>
    </AppShell>
  );
}

function SummaryCard({
  title,
  subtitle,
  meta,
  badge,
  onClick,
}: {
  title: string;
  subtitle: string;
  meta: string;
  badge: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Card
      className="p-4 cursor-pointer hover:border-primary/40 transition-colors active:scale-[0.99]"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => onCardKeyDown(event, onClick)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{title}</p>
            {badge}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{meta}</p>
        </div>
        <ArrowLeft className="size-4 text-primary shrink-0 mt-0.5" />
      </div>
    </Card>
  );
}

function onCardKeyDown(event: React.KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-background/80 border border-border/50 p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-bold text-sm num-en mt-1">{value}</p>
    </div>
  );
}
