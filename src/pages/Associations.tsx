import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Crown, KeyRound, Plus, ScanSearch, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { db, type Association, type Transaction } from "@/lib/db";
import { formatAmount, formatDateTime } from "@/lib/format";
import { OriginalCreatorBadge } from "@/components/OriginalCreatorBadge";

export default function Associations() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Association[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const load = async () => {
      const [assocRows, txRows] = await Promise.all([
        db.associations.orderBy("createdAt").reverse().toArray(),
        db.transactions.toArray(),
      ]);
      setItems(assocRows);
      setTransactions(txRows);
    };

    load();
  }, []);

  const sections = useMemo(
    () => [
      {
        key: "manager",
        title: "كمدير",
        icon: Crown,
        emptyText: "لم تنشئ أي جمعية بعد",
        items: items.filter((assoc) => assoc.role === "manager"),
      },
      {
        key: "member",
        title: "كعضو",
        icon: User,
        emptyText: "لم تنضم إلى أي جمعية بعد",
        items: items.filter((assoc) => assoc.role === "member"),
      },
    ],
    [items]
  );

  return (
    <AppShell>
      <AppHeader
        title="جمعياتي"
        action={
          <Button size="icon" onClick={() => navigate("/associations/new")} className="bg-gradient-primary shadow-glow">
            <Plus className="size-5" />
          </Button>
        }
      />

      <div className="p-4 space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => navigate("/scan")} variant="outline" className="border-primary/30">
            <ScanSearch className="size-4 me-1.5" />
            البحث عبر QR
          </Button>
          <Button onClick={() => navigate("/enter-code")} variant="outline" className="border-primary/30">
            <KeyRound className="size-4 me-1.5" />
            إدخال كود
          </Button>
        </div>

        {sections.map((section) => (
          <Section
            key={section.key}
            title={section.title}
            icon={section.icon}
            items={section.items}
            transactions={transactions}
            emptyText={section.emptyText}
            onClick={(id) => navigate(`/associations/${id}`)}
          />
        ))}
      </div>
    </AppShell>
  );
}

function onCardKeyDown(event: React.KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function Section({
  title,
  icon: Icon,
  items,
  transactions,
  onClick,
  emptyText,
}: {
  title: string;
  icon: typeof Crown;
  items: Association[];
  transactions: Transaction[];
  onClick: (id: string) => void;
  emptyText: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-bold mb-2 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        {title}
        <span className="text-xs text-muted-foreground font-normal">({items.length})</span>
      </h2>

      {items.length === 0 ? (
        <Card className="p-5 text-center border-dashed border-border/50">
          <p className="text-sm font-semibold">لا توجد عناصر</p>
          <p className="text-xs text-muted-foreground mt-1">{emptyText}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((assoc) => {
            const latestTx = transactions
              .filter((tx) => tx.associationId === assoc.id)
              .sort((left, right) => right.createdAt - left.createdAt)[0];

            return (
              <Card
                key={assoc.id}
                onClick={() => onClick(assoc.id)}
                onKeyDown={(event) => onCardKeyDown(event, () => onClick(assoc.id))}
                role="button"
                tabIndex={0}
                className="p-4 cursor-pointer hover:border-primary/40 transition-colors active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
                    <span className="font-bold text-primary-foreground">{assoc.name.slice(0, 2)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {assoc.transferredAt && <OriginalCreatorBadge assoc={assoc} />}
                      <p className="font-bold truncate">{assoc.name}</p>
                    </div>

                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatAmount(assoc.installmentAmount)} جنيه ·{" "}
                      {assoc.role === "manager" ? "أنت المدير" : `دورك #${assoc.myTurn ?? "—"}`}
                    </p>

                    {latestTx ? (
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge
                          variant={
                            latestTx.status === "confirmed"
                              ? "verified"
                              : latestTx.status === "approved"
                                ? "awaiting"
                                : latestTx.status === "cancelled"
                                  ? "failed"
                                  : "pending"
                          }
                          label={
                            latestTx.kind === "payout"
                              ? "آخر عملية: قبض دور"
                              : latestTx.kind === "join"
                                ? "آخر عملية: انضمام"
                                : "آخر عملية: قسط"
                          }
                        />
                        <span className="text-[11px] text-muted-foreground">{formatDateTime(latestTx.createdAt)}</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-2">لا توجد عمليات مسجلة بعد</p>
                    )}
                  </div>

                  <ChevronLeft className="size-5 text-muted-foreground" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
