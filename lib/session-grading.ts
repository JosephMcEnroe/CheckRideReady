export type SessionResult = "PASS" | "PROBE" | "REMEDIATE" | "FAIL";

export type SessionCounts = {
  passCount: number;
  probeCount: number;
  remediateCount: number;
  failCount: number;
};

export const PASSING_SCORE_PERCENT = 70;

export function computeScorePercent(counts: SessionCounts): number {
  const total =
    counts.passCount + counts.probeCount + counts.remediateCount + counts.failCount;
  if (total === 0) return 0;

  const weighted =
    counts.passCount * 1.0 +
    counts.probeCount * 0.75 +
    counts.remediateCount * 0.5 +
    counts.failCount * 0.0;
  return Math.round((weighted / total) * 100);
}

export function computeOverallGrade(counts: SessionCounts): SessionResult {
  const score = computeScorePercent(counts);
  if (score < PASSING_SCORE_PERCENT) return "FAIL";

  if (counts.failCount > 0) return "FAIL";
  if (counts.remediateCount > 0) return "REMEDIATE";
  if (counts.probeCount > 0) return "PROBE";
  return "PASS";
}

export function buildOverallSummary(counts: SessionCounts): string {
  const total =
    counts.passCount + counts.probeCount + counts.remediateCount + counts.failCount;
  const grade = computeOverallGrade(counts);
  const score = computeScorePercent(counts);
  return `Overall ${grade} at ${score}%. PASS ${counts.passCount}, PROBE ${counts.probeCount}, REMEDIATE ${counts.remediateCount}, FAIL ${counts.failCount} across ${total} graded question(s). Passing threshold: ${PASSING_SCORE_PERCENT}%.`;
}
