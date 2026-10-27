import { DAY_MS, startOfDay } from '@/engine/time';

export function dueLabel(due: number, now: number): string {
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS);
  if (days <= 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  if (days < 30) return `In ${Math.round(days / 7)} wk`;
  return `In ${Math.round(days / 30)} mo`;
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function minutes(ms: number): string {
  const m = Math.round(ms / 60_000);
  return m < 1 ? '<1 min' : `${m} min`;
}

export function timeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${Math.round((100 * n) / d)}%`;
}

/** Reviews are due by day, so this says "tomorrow", not a clock time. */
export function nextReviewLabel(due: number, now: number): string {
  const label = dueLabel(due, now);
  return label === 'Due today' ? 'later today' : label.toLowerCase();
}
