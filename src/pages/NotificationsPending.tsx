import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Copy, ExternalLink, Share2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { db, type PendingOp, type Transaction } from "@/lib/db";
import { formatAmount, formatDateTime } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function NotificationsPending() {
  const navigate = useNavigate();
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [activeCodes, setActiveCodes] = useState<PendingOp[]>([]);

  useEffect(() => {
    const load = async () => {
      const [txRows, pendingRows] = await Promise.all([
        db.transactions.orderBy("createdAt").reverse().toArray(),
        db.pendingOps.toArray(),
      ]);

      setPendingTransactions(
        txRows.filter((tx) => tx.status === "approved" || tx.status === "pending").sort((a, b) => b.createdAt - a.createdAt)
      );
      setActiveCodes(
        pendingRows
          .filter((item) => !item.used && item.expiresAt > Date.now())
          .sort((a, b) => b.createdAt - a.createdAt)
      );
    };

    load();
  }, []);

  const totalItems = pendingTransactions.length + activeCodes.length;

  const shareCode = async (op: PendingOp) => {
    if (!op.text) {
      toast({ title: "هذا الكود قديم ولا يمكن مشاركته من هذه الصفحة", variant: "destructive" });
      return;
    }

    const message = `${op.kind === "approval-out" ? "كود تأكيد موني نوت" : "كود دفع موني نوت"}\n${op.text}\n\nصالح حتى ${formatDateTime(op.expiresAt)}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: message });
      } else {
        await navigator.clipboard.writeText(message);
        toast({ title: "تم نسخ الرسالة" });
      }
    } catch {
      toast({ title: "تعذّرت المشاركة", variant: "destructive" });
    }
  };

  const copyCode = async (op: PendingOp) => {
    if (!op.text) {
      toast({ title: "هذا الكود قديم ولا يمكن نسخه من هذه الصفحة", variant: "destructive" });
      return;
    }
    await navigator.clipboard.writeText(op.text);
    toast({ title: "تم نسخ الكود" });
  };

  const latestHint = useMemo(() => {
    const latestPendingTx = pendingTransactions[0];
    const latestCode = activeCodes[0];
    const candidates = [
      latestPendingTx ? { ts: latestPendingTx.createdAt, text: "آخر عنصر بانتظار تأكيد طرف آخر" } : null,
      latestCode ? { ts: latestCode.createdAt, text: "آخر عنصر هو كود نشط قابل للنسخ أو المشاركة" } : null,
    ].filter(Boolean) as { ts: number; text: string }[];

    return candidates.sort((a, b) => b.ts - a.ts)[0]?.text ?? "لا توجد عناصر معلقة حاليًا";
  }, [activeCodes, pendingTransactions]);

  return (
    <AppShell>
      <AppHeader title="الإشعارات والمعلقة" subtitle={`${totalItems} عنصر · ${latestHint}`} />

      <div className="p-4 space-y-4 animate-fade-in">
        {totalItems === 0 ? (
          <Card className="p-8 text-center border-dashed border-border/50">
            <AlertCircle className="size-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold">لا توجد عناصر معلقة</p>
            <p className="text-xs text-muted-foreground mt-1">أي دفعات بانتظار تأكيد أو أكواد نشطة ستظهر هنا.</p>
          </Card>
        ) : (
          <>
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="size-4 text-warning" />
                  عمليات بانتظار الإجراء
                </h2>
                {pendingTransactions.length > 0 && (
                  <StatusBadge variant="awaiting" label={`${pendingTransactions.length} عملية`} />
                )}
              </div>

              {pendingTransactions.length === 0 ? (
                <Card className="p-4 text-center border-dashed border-border/50">
                  <p className="text-xs text-muted-foreground">لا توجد عمليات مالية معلقة الآن</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {pendingTransactions.map((tx) => (
                    <Card
                      key={tx.id}
                      className="p-3 cursor-pointer hover:border-primary/40 transition-colors active:scale-[0.99]"
                      onClick={() => navigate("/history")}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate("/history");
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate">
                              {tx.kind === "payout" ? "قبض دور بانتظار التأكيد" : "عملية بانتظار التأكيد"}
                            </p>
                            <StatusBadge variant={tx.status === "approved" ? "awaiting" : "pending"} />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {tx.associationName} · {formatAmount(tx.amount)} جنيه · {formatDateTime(tx.createdAt)}
                          </p>
                        </div>
                        <ExternalLink className="size-4 text-primary shrink-0 mt-0.5" />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Share2 className="size-4 text-primary" />
                  الأكواد النشطة
                </h2>
                {activeCodes.length > 0 && <StatusBadge variant="pending" label={`${activeCodes.length} كود`} />}
              </div>

              {activeCodes.length === 0 ? (
                <Card className="p-4 text-center border-dashed border-border/50">
                  <p className="text-xs text-muted-foreground">لا توجد أكواد نشطة الآن</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {activeCodes.map((op) => (
                    <Card key={op.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">
                                {op.kind === "approval-out" ? "كود تأكيد جاهز للإرسال" : "كود دفع نشط"}
                              </p>
                              <StatusBadge variant={op.kind === "approval-out" ? "awaiting" : "pending"} />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {op.associationName} · ينتهي {formatDateTime(op.expiresAt)}
                            </p>
                          </div>
                        </div>

                        {op.text ? (
                          <div className="rounded-xl bg-background/80 border border-primary/20 p-3 break-all text-xs font-mono num-en select-all">
                            {op.text}
                          </div>
                        ) : (
                          <div className="rounded-xl bg-warning/10 border border-warning/30 p-3 text-xs text-warning">
                            هذا الكود محفوظ من نسخة أقدم ولا يمكن إعادة عرضه نصيًا من هذه الصفحة.
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => copyCode(op)} variant="outline" disabled={!op.text}>
                            <Copy className="size-4 me-1.5" />
                            نسخ
                          </Button>
                          <Button onClick={() => shareCode(op)} className="bg-gradient-primary" disabled={!op.text}>
                            <Share2 className="size-4 me-1.5" />
                            مشاركة
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
