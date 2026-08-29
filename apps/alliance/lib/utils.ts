import { clsx, type ClassValue } from 'clsx';

/** className combinator. Deliberately no tailwind-merge — the token set is
 * small and closed, so conflicting utility collisions are rare and easy to
 * spot in review. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatClockTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
