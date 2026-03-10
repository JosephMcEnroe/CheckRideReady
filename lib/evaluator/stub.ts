export type EvaluationResultCode = "PASS" | "PROBE" | "REMEDIATE" | "FAIL";

export type EvaluationOutput = {
  result: EvaluationResultCode;
  confidence: number;
  feedback: string;
  missing_points: string[];
  probe_question: string;
  recommended_delta: number;
  acs_task_code: string;
};

type EvaluateInput = {
  userAnswer: string;
  acs_task_code: string;
};

const RED_FLAG_PHRASES = [
  "doesn't matter",
  "doesnt matter",
  "optional",
  "ignore",
  "always fine",
  "never check",
  "skip checklist",
  "don't check",
  "dont check",
];

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(text));
}

export function evaluateStub({ userAnswer, acs_task_code }: EvaluateInput): EvaluationOutput {
  const raw = (userAnswer || "").trim();
  const lower = raw.toLowerCase();
  const words = raw.split(/\s+/).filter(Boolean).length;

  const definitionOk = hasAny(lower, [
    /\b(is|means|defined as|definition)\b/,
    /\b(a|an)\b.+\bthat\b/,
  ]);
  const sourceOk = hasAny(lower, [
    /\b(far|14 cfr|regulation|aim|acs|afh|poh|fih)\b/,
    /\b(section|part)\b\s*\d+/,
  ]);
  const processOk = hasAny(lower, [
    /\b(first|then|next|after|before|finally)\b/,
    /\b(step|procedure|checklist|sequence)\b/,
  ]);
  const safetyOk = hasAny(lower, [
    /\b(risk|hazard|mitigate|mitigation|safe|safety|go\/no-go)\b/,
    /\b(minimums|weather|currency|airworthiness)\b/,
  ]);

  const redFlag = RED_FLAG_PHRASES.some((p) => lower.includes(p));

  const missing: string[] = [];
  if (!definitionOk) missing.push("State a crisp definition first.");
  if (!sourceOk) missing.push("Cite a source (FAR/AIM/ACS/POH) for authority.");
  if (!processOk) missing.push("Give step-by-step process in order.");
  if (!safetyOk) missing.push("Explain safety risk and mitigation.");

  let result: EvaluationResultCode = "PASS";
  let recommended_delta = 0.6;
  let feedback =
    "Solid structure. Keep tightening references and keep your process safety-first.";
  let confidence = 0.72;

  if (redFlag) {
    result = "FAIL";
    recommended_delta = -1.0;
    feedback =
      "Unsafe reasoning detected. Re-answer with explicit legal source, checklist process, and risk controls.";
    confidence = 0.9;
  } else if (words < 18 || missing.length >= 3) {
    result = "REMEDIATE";
    recommended_delta = -0.6;
    feedback =
      "Answer is too thin for checkride depth. Rebuild it with definition, authority, process, and safety implications.";
    confidence = 0.82;
  } else if (words < 40 || missing.length >= 1) {
    result = "PROBE";
    recommended_delta = 0.2;
    feedback =
      "Partially correct. Add missing structure and be more specific with source and risk reasoning.";
    confidence = 0.66;
  }

  const probeFocus =
    missing[0] ||
    "Tighten your answer with clearer source, ordered process, and risk mitigation.";

  const probe_question = `Follow-up on ${acs_task_code}: ${probeFocus} In 4-6 sentences, answer using definition -> source -> process -> safety/risk.`;

  return {
    result,
    confidence: clamp01(confidence),
    feedback,
    missing_points: missing,
    probe_question,
    recommended_delta,
    acs_task_code,
  };
}
