/**
 * Self-healing QOTD streak.
 *
 * Instead of trusting an incrementally-updated counter in `user_streaks` (which
 * silently breaks if the fire-and-forget gamification write times out, or drifts
 * after a QOTD schedule reset), we derive the streak from the dates the user
 * actually answered a Question of the Day. Always correct; can't be lost to a
 * failed write.
 *
 * Rules (match the program's QOTD cadence):
 *   - One QOTD per weekday; weekends are skipped and never count as a break.
 *   - The streak is the run of consecutive weekdays — counting back from the most
 *     recent weekday in play — on which the user answered.
 *   - The current weekday gets a grace period: not having answered *today* yet
 *     doesn't break the streak; it simply isn't counted until answered.
 *
 * All dates are EST 'YYYY-MM-DD' strings (produce them with getTodayDateString).
 */

/** Day-of-week for an EST date string. Built as a local date — DOW is tz-stable. */
function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0 = Sun ... 6 = Sat
}

function isWeekend(dateStr: string): boolean {
  const dow = dayOfWeek(dateStr);
  return dow === 0 || dow === 6;
}

/** The previous weekday (skips Sat/Sun) as an EST 'YYYY-MM-DD' string. */
function prevWeekday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  do {
    dt.setDate(dt.getDate() - 1);
  } while (dt.getDay() === 0 || dt.getDay() === 6);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/**
 * Current QOTD weekday streak, derived from the EST dates the user answered a
 * QOTD. `today` is an EST 'YYYY-MM-DD' string (e.g. from getTodayDateString()).
 */
export function computeQotdStreak(answeredEstDates: string[], today: string): number {
  const answered = new Set(answeredEstDates);

  // Pick the most recent weekday "in play":
  //   - weekend today                       -> step back to Friday
  //   - weekday today, not yet answered     -> grace: start from the previous weekday
  let cursor = today;
  if (isWeekend(cursor)) {
    cursor = prevWeekday(cursor);
  } else if (!answered.has(cursor)) {
    cursor = prevWeekday(cursor);
  }

  // Count consecutive answered weekdays going backwards.
  let streak = 0;
  while (!isWeekend(cursor) && answered.has(cursor)) {
    streak += 1;
    cursor = prevWeekday(cursor);
  }
  return streak;
}
