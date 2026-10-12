/** Licence-expiry reminder milestones, in days before expiry. */
export const REMINDER_MILESTONES = [90, 30, 7, 0] as const;

/**
 * The milestone to remind about for a licence `daysLeft` from expiry, or null if none applies.
 * Picks only the nearest milestone, so a licence first seen at 20 days gets the 30-day reminder
 * once (not 90 and 30 together). Each milestone is then de-duplicated per licence in email_logs.
 */
export function reminderMilestone(daysLeft: number | null): (typeof REMINDER_MILESTONES)[number] | null {
  if (daysLeft === null || daysLeft < 0 || daysLeft > REMINDER_MILESTONES[0]) return null;
  let pick: (typeof REMINDER_MILESTONES)[number] = REMINDER_MILESTONES[0];
  for (const m of REMINDER_MILESTONES) if (daysLeft <= m) pick = m;
  return pick;
}
