import { useEffect, useMemo, useState } from "react";
import { Filter, RotateCcw, ScrollText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { QRDisplay } from "@/components/QRDisplay";
import { db, type Association, type Transaction } from "@/lib/db";
import { encodeQr, type HistoryQr } from "@/lib/qr-payload";
import { useIdentity } from "@/hooks/useIdentity";
import { formatAmount, formatDateTime } from "@/lib/format";

type StatusFilter = "all" | "confirmed" | "approved" | "pending" | "cancelled";
type TypeFilter = "all" | "installment" | "payout" | "join" | "transfer";
type DateFilter = "all" | "today" | "7d" | "30d";

export default function History() {
  const { identity } = useIdentity();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [associationFilter, setAssociationFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [verifyQr, setVerifyQr] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [txRows, assocRows] = await Promise.all([
        db.transactions.orderBy("createdAt").reverse().toArray(),
        db.associations.toArray(),
      ]);

      setTxs(txRows);
      setAssociations(assocRows);
    };

    load();
  }, []);

  const visible = useMemo(() => {
    const now = Date.now();

    return txs.filter((tx) => {
      const statusOk = statusFilter === "all" || tx.status === statusFilter;
      const typeOk = typeFilter === "all" || tx.kind === typeFilter;
      const associationOk = associationFilter === "all" || tx.associationId === associationFilter;
      const dateOk =
        dateFilter === "all" ||
        (dateFilter === "today" && now - tx.createdAt <= 24 * 60 * 60 * 1000) ||
        (dateFilter === "7d" && now - tx.createdAt <= 7 * 24 * 60 * 60 * 1000) ||
        (dateFilter === "30d" && now - tx.createdAt <= 30 * 24 * 60 * 60 * 1000);

      return statusOk && typeOk && associationOk && dateOk;
    });
  }, [associationFilter, dateFilter, statusFilter, txs, typeFilter]);

  const openTx = async (tx: Transaction) => {
    setSelected(tx);
    if (!identity) return;

    const payload: HistoryQr = {
      t: "history",
      pid: identity.publicId,
      name: identity.name,
      associations: associations.map((assoc) => ({
        aid: assoc.id,
        name: assoc.name,
        turn: assoc.myTurn ?? 0,
      })),
      txs: [
        {
          id: tx.id,
          aid: tx.associationId,
          amount: tx.amount,
          date: tx.createdAt,
          turn: tx.turn,
        },
      ],
    };

    setVerifyQr(encodeQr(payload));
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setDateFilter("all");
    setAssociationFilter("all");
  };

  return (
    <AppShell>
      <AppHeader title="سجل العمليات" subtitle={`${visible.length} عملية مطابقة للفلاتر`} />

      <div className="p-4 animate-fade-in space-y-4">
        <Card className="p-4 space-y-3 border-border/50">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Filter className="size-4 text-primary" />
              الفلاتر
            </h2>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="size-4 me-1.5" />
              تصفير
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select value={associationFilter} onValueChange={setAssociationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الجمعية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الجمعيات</SelectItem>
                {associations.map((assoc) => (
                  <SelectItem key={assoc.id} value={assoc.id}>
                    {assoc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                <SelectItem value="installment">سداد قسط</SelectItem>
                <SelectItem value="payout">قبض دور</SelectItem>
                <SelectItem value="join">انضمام</SelectItem>
                <SelectItem value="transfer">نقل ملكية</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="confirmed">مكتملة</SelectItem>
                <SelectItem value="approved">بانتظار التأكيد</SelectItem>
                <SelectItem value="pending">معلقة</SelectItem>
                <SelectItem value="cancelled">ملغاة</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="التاريخ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفترات</SelectItem>
                <SelectItem value="today">آخر 24 ساعة</SelectItem>
                <SelectItem value="7d">آخر 7 أيام</SelectItem>
                <SelectItem value="30d">آخر 30 يومًا</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {visible.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-border/50">
            <ScrollText className="size-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold">لا توجد عمليات مطابقة</p>
            <p className="text-xs text-muted-foreground mt-1">غيّر الفلاتر أو انتظر حتى تُسجَّل عمليات جديدة.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {visible.map((tx) => (
              <Card
                key={tx.id}
                onClick={() => openTx(tx)}
                onKeyDown={(event) => onCardKeyDown(event, () => openTx(tx))}
                role="button"
                tabIndex={0}
                className="p-3 cursor-pointer hover:border-primary/40 active:scale-[0.99] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate">{tx.associationName}</p>
                      <span className="text-[10px] text-muted-foreground">
                        #<span className="num-en">{tx.turn}</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {tx.side === "member" ? `إلى ${tx.managerName}` : `من ${tx.memberName}`} · {formatDateTime(tx.createdAt)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {tx.kind === "payout" ? "قبض دور" : tx.kind === "join" ? "انضمام" : tx.kind === "transfer" ? "نقل ملكية" : "قسط"}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-bold num-en text-success">{formatAmount(tx.amount)}</p>
                    <StatusBadge
                      variant={
                        tx.status === "confirmed"
                          ? "verified"
                          : tx.status === "approved"
                            ? "awaiting"
                            : tx.status === "cancelled"
                              ? "failed"
                              : "pending"
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تفاصيل العملية</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 pt-2">
              <div className="grid gap-1.5 text-sm">
                <Row label="الجمعية" value={selected.associationName} />
                <Row label="المبلغ" value={`${formatAmount(selected.amount)} جنيه`} />
                <Row label="الدور" value={`#${selected.turn}`} />
                <Row label="المدير" value={selected.managerName} />
                <Row label="رقم العملية" value={selected.id.slice(0, 8).toUpperCase()} />
                <Row label="النوع" value={selected.kind === "payout" ? "قبض دور" : selected.kind === "join" ? "انضمام" : selected.kind === "transfer" ? "نقل ملكية" : "قسط"} />
                <Row label="التاريخ" value={formatDateTime(selected.createdAt)} />
                <Row
                  label="الحالة"
                  value={
                    selected.status === "confirmed"
                      ? "مكتملة"
                      : selected.status === "approved"
                        ? "بانتظار التأكيد"
                        : selected.status === "cancelled"
                          ? "ملغاة"
                          : "معلقة"
                  }
                />
              </div>
              {verifyQr && (
                <div className="flex flex-col items-center gap-2 pt-2 border-t border-border/40">
                  <p className="text-xs text-muted-foreground">QR التحقق الخاص بهذه العملية</p>
                  <QRDisplay value={verifyQr} size={180} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function onCardKeyDown(event: React.KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 last:border-0 py-1 gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-end">{value}</span>
    </div>
  );
}
