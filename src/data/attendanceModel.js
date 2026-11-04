
export function predictAttendance(
  { attended, total, trend, syllabusPct },
  missedTopics = 0
) {
  if (
    !Number.isFinite(attended) ||
    !Number.isFinite(total) ||
    !Number.isFinite(syllabusPct) ||
    !Number.isFinite(missedTopics) ||
    attended < 0 ||
    total < 0 ||
    attended > total ||
    syllabusPct < 0 ||
    syllabusPct > 100 ||
    missedTopics < 0
  ) {
    throw new RangeError('Invalid attendance prediction inputs.');
  }

  const currentPercent = total > 0 ? (attended / total) * 100 : 0;

  // A simple heuristic estimate, not a trained ML model.
  let adjustment = 0;

  if (trend === 'up') adjustment += 3;
  if (trend === 'down') adjustment -= 5;

  adjustment += (syllabusPct - 50) * 0.04;
  adjustment -= Math.min(missedTopics, 10) * 0.5;

  const predicted = Math.round(
    Math.max(0, Math.min(100, currentPercent + adjustment))
  );

  const confidence = total === 0
    ? 0
    : Math.round(Math.min(95, 40 + total * 5));

  return { predicted, confidence };
}
