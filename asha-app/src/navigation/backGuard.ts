/**
 * One global "back" interceptor for screens that must not be left by accident
 * (e.g. a half-filled survey). App.tsx's hardware-back handler asks the guard first;
 * if the guard returns true, the back press is consumed.
 *
 * Needed because React Native calls the most recently registered BackHandler first,
 * and App.tsx re-registers its handler after child screens mount.
 */
type Guard = () => boolean;

let current: Guard | null = null;

export function setBackGuard(guard: Guard | null): void {
  current = guard;
}

export function runBackGuard(): boolean {
  return current ? current() : false;
}
