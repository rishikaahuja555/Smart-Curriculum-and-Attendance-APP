
export function calculateSafeAbsences(
  attended,
  total,
  upcomingSessions,
  requiredFraction
) {
  if (
    !Number.isInteger(attended) ||
    !Number.isInteger(total) ||
    !Number.isInteger(upcomingSessions) ||
    attended < 0 ||
    total < 0 ||
    upcomingSessions < 0 ||
    attended > total ||
    !Number.isFinite(requiredFraction) ||
    requiredFraction <= 0 ||
    requiredFraction > 1
  ) {
    throw new RangeError('Invalid attendance counts or required fraction.');
  }

  const absencesAllowed =
    Math.floor((attended + upcomingSessions) -
      (requiredFraction * (total + upcomingSessions)));

  return Math.max(0, absencesAllowed);
}
