const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const relativeUnits = [
  { label: "year", milliseconds: YEAR },
  { label: "month", milliseconds: MONTH },
  { label: "week", milliseconds: WEEK },
  { label: "day", milliseconds: DAY },
  { label: "hour", milliseconds: HOUR },
  { label: "minute", milliseconds: MINUTE },
] as const;

export function formatRelativeTime(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "unknown time";

  const difference = now - timestamp;
  const elapsed = Math.abs(difference);
  if (elapsed < MINUTE) return "just now";

  const unit = relativeUnits.find(({ milliseconds }) => elapsed >= milliseconds);
  if (!unit) return "just now";

  const amount = Math.max(1, Math.floor(elapsed / unit.milliseconds));
  const label = `${unit.label}${amount === 1 ? "" : "s"}`;
  return difference < 0 ? `in ${amount} ${label}` : `${amount} ${label} ago`;
}

export function formatBytes(byteCount: number) {
  if (byteCount < 1_000) return `${byteCount} B`;
  if (byteCount < 1_000_000) return `${(byteCount / 1_000).toFixed(1)} kB`;
  if (byteCount < 1_000_000_000) {
    return `${(byteCount / 1_000_000).toFixed(1)} MB`;
  }
  return `${(byteCount / 1_000_000_000).toFixed(1)} GB`;
}
