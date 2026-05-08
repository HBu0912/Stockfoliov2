function relTime(d: Date | string) {
  const t = typeof d === "string" ? new Date(d) : d;
  return t.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function formatPctChangeLine(p: {
  userLabel: string;
  symbol: string;
  title: string;
  kind: string;
  pct: number;
  oldShares: number;
  newShares: number;
  at: Date | string;
  accountName?: string | null;
}): string {
  const who = p.userLabel;
  const when = relTime(p.at);
  const ac = p.accountName ? ` in ${p.accountName}` : "";
  let action = "";
  switch (p.kind) {
    case "NEW":
      action = `opened ${p.symbol} - new position, +100% of the line${ac}`;
      break;
    case "INCREASE":
      action = `added to ${p.symbol}: +${p.pct.toFixed(1)}% vs the prior total position${ac}`;
      break;
    case "REDUCE":
      action = `trimmed ${p.symbol}: ${p.pct.toFixed(1)}% of the prior total position sold${ac}`;
      break;
    case "CLOSE":
      action = `closed ${p.symbol}: 100% of the line sold${ac}`;
      break;
    default:
      action = `updated ${p.symbol} (${p.title})${ac}`;
  }
  return `${who} ${action} · ${when}`;
}
