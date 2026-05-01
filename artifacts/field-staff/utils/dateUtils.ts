const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export function formatDateDMY(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date + (date.length === 10 ? "T00:00:00" : "")) : date;
  const day   = d.getDate().toString().padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  const year  = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function todayDMY(): string {
  return formatDateDMY(new Date());
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export function formatRangeDMY(from: string, to: string): string {
  if (from === to) return formatDateDMY(from);
  return `${formatDateDMY(from)} - ${formatDateDMY(to)}`;
}
