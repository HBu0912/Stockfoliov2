import { prisma } from "./prisma";
import { computePositionChange } from "./position-pct";
import type { ChangeKind } from "./position-pct";

/**
 * Log global + (optional) per-account feed rows for a single line change.
 */
export async function recordHoldingPositionChange(
  userId: string,
  oldShares: number,
  newShares: number,
  symbol: string,
  title: string,
  accountId: string,
  accountName: string
) {
  const delta = computePositionChange(oldShares, newShares);
  if (!delta) return;

  const { kind, pct } = delta;
  const kindToStore = kind as ChangeKind;

  await prisma.$transaction([
    prisma.feedEvent.create({
      data: {
        userId,
        symbol,
        title,
        kind: kindToStore,
        pct,
        oldShares,
        newShares,
        accountName,
      },
    }),
    prisma.accountFeedEvent.create({
      data: {
        accountId,
        symbol,
        title,
        kind: kindToStore,
        pct,
        oldShares,
        newShares,
      },
    }),
  ]);
}

export async function deleteHoldingWithFeed(
  userId: string,
  holding: {
    id: string;
    accountId: string;
    symbol: string;
    name: string;
    shares: number;
  },
  accountName: string
) {
  const o = holding.shares;
  const n = 0;
  const delta = computePositionChange(o, n);
  if (delta) {
    await prisma.$transaction([
      prisma.feedEvent.create({
        data: {
          userId,
          symbol: holding.symbol,
          title: holding.name,
          kind: delta.kind,
          pct: delta.pct,
          oldShares: o,
          newShares: n,
          accountName,
        },
      }),
      prisma.accountFeedEvent.create({
        data: {
          accountId: holding.accountId,
          symbol: holding.symbol,
          title: holding.name,
          kind: delta.kind,
          pct: delta.pct,
          oldShares: o,
          newShares: n,
        },
      }),
      prisma.holding.delete({ where: { id: holding.id } }),
    ]);
  } else {
    await prisma.holding.delete({ where: { id: holding.id } });
  }
}
