import { db } from "./db";
import { cleanupExpired } from "./text-codes";

const TRANSACTION_CONFIRM_TTL_MS = 24 * 60 * 60 * 1000;

export async function runLocalMaintenance() {
  await cleanupExpired();

  const now = Date.now();
  const transactions = await db.transactions.toArray();
  const stale = transactions.filter((tx) => {
    if (tx.status !== "approved" && tx.status !== "pending") return false;
    const baseTime = tx.approvedAt ?? tx.createdAt;
    return now - baseTime > TRANSACTION_CONFIRM_TTL_MS;
  });

  await Promise.all(
    stale.map((tx) =>
      db.transactions.update(tx.id, {
        status: "cancelled",
        cancelledAt: now,
      })
    )
  );
}
