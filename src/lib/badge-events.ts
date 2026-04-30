export const BADGE_EVENTS = {
  alerts: "alerts:changed",
  scanner: "scanner:changed",
} as const;

export const notifyAlertsChanged = () =>
  window.dispatchEvent(new Event(BADGE_EVENTS.alerts));

export const notifyScannerChanged = () =>
  window.dispatchEvent(new Event(BADGE_EVENTS.scanner));