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
  const globalAgg = await prisma.holding.aggregate({
    where: { account: { userId }, symbol },
    _sum: { shares: true },
  });
  const globalNew = globalAgg?._sum?.shares ?? 0;
  const globalOld = globalNew - newShares + oldShares;
  const globalDelta = computePositionChange(globalOld, globalNew);
  const lineDelta = computePositionChange(oldShares, newShares);
  if (!globalDelta && !lineDelta) return;

  const ops = [];
  if (globalDelta) {
    ops.push(
      prisma.feedEvent.create({
        data: {
          userId,
          symbol,
          title,
          kind: globalDelta.kind as ChangeKind,
          pct: globalDelta.pct,
          oldShares: globalOld,
          newShares: globalNew,
          accountName,
        },
      })
    );
  }
  if (lineDelta) {
    ops.push(
      prisma.accountFeedEvent.create({
        data: {
          accountId,
          symbol,
          title,
          kind: lineDelta.kind as ChangeKind,
          pct: lineDelta.pct,
          oldShares,
          newShares,
        },
      })
    );
  }
  if (ops.length) await prisma.$transaction(ops);
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
  const globalAgg = await prisma.holding.aggregate({
    where: { account: { userId }, symbol: holding.symbol },
    _sum: { shares: true },
  });
  const globalOld = globalAgg._sum.shares ?? 0;
  const globalNew = Math.max(0, globalOld - holding.shares);
  const globalDelta = computePositionChange(globalOld, globalNew);
  const lineDelta = computePositionChange(holding.shares, 0);
  const ops = [];
  if (globalDelta) {
    ops.push(
      prisma.feedEvent.create({
        data: {
          userId,
          symbol: holding.symbol,
          title: holding.name,
          kind: globalDelta.kind,
          pct: globalDelta.pct,
          oldShares: globalOld,
          newShares: globalNew,
          accountName,
        },
      })
    );
  }
  if (lineDelta) {
    ops.push(
      prisma.accountFeedEvent.create({
        data: {
          accountId: holding.accountId,
          symbol: holding.symbol,
          title: holding.name,
          kind: lineDelta.kind,
          pct: lineDelta.pct,
          oldShares: holding.shares,
          newShares: 0,
        },
      })
    );
  }
  ops.push(prisma.holding.delete({ where: { id: holding.id } }));
  await prisma.$transaction(ops);
}
