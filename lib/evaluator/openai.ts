import { getOpenAIClient } from "@/lib/openai";

export type EvaluationResultCode = "PASS" | "PROBE" | "REMEDIATE" | "FAIL";

export type OpenAIEvaluation = {
  result: EvaluationResultCode;
  confidence: number;
  feedback: string;
  missing_points: string[];
  probe_question: string | null;
  acs_task_code: string;
};

type EvaluateInput = {
  questionStem: string;
  studentAnswer: string;
  acsTaskCode: string;
  mustInclude?: string[];
  escalationLevel?: number;
  priorFollowUps?: string[];
  priorThread?: Array<{
    question: string;
    answer: string | null;
    feedback: string | null;
    result: EvaluationResultCode | null;
  }>;
  weatherContext?: {
    airport?: string;
    aircraft?: string;
    wind?: string;
    visibility?: string;
    ceiling?: string;
    raw?: string;
  } | null;
};

const EVAL_MODEL = process.env.OPENAI_EVAL_MODEL || "gpt-4.1-nano";
const PROBE_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

const WEATHER_SYSTEM_ADDENDUM = `\nIf weather context is provided below, reference today's actual conditions naturally in your questions where relevant. Ask scenario-based questions that a real DPE would ask given these specific conditions.`;

const SYSTEM_PROMPT = `You are an FAA Designated Pilot Examiner conducting a Part 61 oral examination.
You are professional, direct, and thorough. You do not praise students.
You probe weak answers without mercy but remain fair and professional.
Always reference specific FARs, AIM sections, or ACS codes when relevant.
Speak in first person — terse, clinical, precise.
Never say Great answer or Well done.
Feedback is 2-3 sentences maximum. Be direct. No encouragement — only correction or confirmation.
Always tie questions to the student's specific aircraft and today's actual weather conditions if provided.`;

const SCORING_SYSTEM_PROMPT = `You are an FAA DPE evaluating a student oral exam answer.
Read the student's answer carefully and completely before scoring.
Credit the student for EVERYTHING they said correctly.
Only penalize for what is genuinely missing or incorrect.

Scoring guide:
- PASS: Student demonstrated comprehensive understanding. Answer must cover ALL or nearly all required points for this ACS task. Missing even one significant required point should result in PROBE not PASS. Do not give PASS if the student only partially covered the topic. Be strict — a real DPE would probe any gap in knowledge.
- PROBE: Answer is mostly correct but missing 1-2 specific points that a DPE would follow up on. This is the most common result for a decent but incomplete answer.
- REMEDIATE: Answer has significant gaps or some incorrect information. Student needs to review this topic before retesting.
- FAIL: Answer is fundamentally wrong, unsafe, or shows dangerous misunderstanding. Reserve FAIL for genuinely bad answers only.

IMPORTANT: If a student explicitly cites a specific FAR or AIM section and correctly applies it, that MUST be credited. Do not give FAIL if the student clearly demonstrated the required knowledge.

Only give confidence above 0.8 if the answer is truly comprehensive and covers all required points with specific details and regulatory references.

Feedback must be 2-3 sentences. Be specific about what was good and what specifically was missing — not generic criticism.
Reference FAR/AIM sections when relevant (e.g. FAR 91.155, AIM 7-1-27).
Return only the JSON schema provided.`;

const PROBE_SYSTEM_PROMPT = `You are an FAA Designated Pilot Examiner conducting a Part 61 oral examination.
You are professional, direct, and thorough. You do not praise students.
You probe genuine gaps in knowledge. If the student cited a regulation correctly and applied it accurately, acknowledge that and probe something they actually missed — do not ask them to repeat something they already said.
You always reference specific FARs, AIM sections, or ACS codes when relevant.
You speak in first person as the examiner — terse, clinical, precise.
Never say 'Great answer' or 'Well done.'
When probing use phrases like:
'Walk me through that again.'
'You mentioned X — what is the regulatory basis for that?'
'Okay. Now put that into practice — you are at 3,500 feet, 800 foot ceiling, 3SM visibility. What are you doing?'
Always tie questions to the student's specific aircraft and today's actual weather conditions if provided.
Your follow-up question MUST be scenario-based where possible.
Do not ask what the FAR says about X — instead ask what would YOU do in this situation and why.
The scenario should use the student's aircraft type and today's weather conditions if available.
Never repeat a question already asked in this thread.
If mastery is clearly demonstrated return null.`;

// Scoring-only schema (Call 1)
const SCORING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["result", "confidence", "feedback", "missing_points", "acs_task_code"],
  properties: {
    result: { type: "string", enum: ["PASS", "PROBE", "REMEDIATE", "FAIL"] },
    confidence: { type: "number" },
    feedback: { type: "string" },
    missing_points: { type: "array", items: { type: "string" } },
    acs_task_code: { type: "string" },
  },
};

// Probe-only schema (Call 2)
const PROBE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["probe_question"],
  properties: {
    probe_question: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
};

const RED_FLAG_PHRASES = [
  "doesn't matter",
  "doesnt matter",
  "always fine",
  "never check",
  "skip checklist",
  "dont check",
  "don't need to",
  "not required",
];

const RE_REGULATORY = /\b(far|14 cfr|91\.\d+|aim|acs|61\.\d+)\b/i;
const RE_PROCESS = /\b(first|then|next|after|before|step|procedure)\b/i;
const RE_SAFETY = /\b(risk|hazard|safe|safety|emergency|minimum)\b/i;
const RE_DEFINITION = /\b(is defined|means|refers to|known as)\b/i;

export function preEvaluate(
  answer: string
): { skip: false } | { skip: true; result: EvaluationResultCode; reason: string } {
  const wordCount = answer.trim().split(/\s+/).length;

  if (wordCount < 10) {
    return { skip: true, result: "REMEDIATE", reason: "Answer too short" };
  }

  const lower = answer.toLowerCase();
  for (const phrase of RED_FLAG_PHRASES) {
    if (lower.includes(phrase)) {
      return { skip: true, result: "FAIL", reason: "Unsafe reasoning detected" };
    }
  }

  if (wordCount > 15) {
    const signals = [RE_REGULATORY, RE_PROCESS, RE_SAFETY, RE_DEFINITION].filter((re) =>
      re.test(answer)
    ).length;
    if (signals >= 2) {
      return { skip: false };
    }
  }

  return { skip: false };
}

function isResult(v: unknown): v is EvaluationResultCode {
  return v === "PASS" || v === "PROBE" || v === "REMEDIATE" || v === "FAIL";
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// Uses the singleton OpenAI SDK client so the underlying HTTP/2 connection is reused
// across requests (avoids per-call TCP+TLS handshake overhead).
async function runOpenAIWithModel(
  messages: Array<{ role: "system" | "user"; content: string }>,
  model: string,
  maxTokens: number,
  schema: Record<string, unknown>,
  schemaName: string
) {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model,
    messages,
    max_completion_tokens: maxTokens,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        schema,
      },
    },
  });

  const choice = response.choices[0];
  const content = choice?.message?.content;

  if (!content || typeof content !== "string") {
    const refusal = choice?.message?.refusal;
    const finishReason = choice?.finish_reason;
    if (refusal) throw new Error(`OpenAI refused: ${refusal}`);
    if (finishReason === "length") throw new Error("OpenAI hit max_tokens — response truncated");
    throw new Error("OpenAI returned empty content");
  }

  return content;
}

// How many recent turns to keep in full — older turns beyond this are compressed.
const FULL_CONTEXT_TURNS = 2;

function buildThreadContext(
  thread: EvaluateInput["priorThread"] & object
): string {
  if (!thread || thread.length === 0) return "No prior thread items.";

  // All turns fit within the full-context window — send everything in full.
  if (thread.length <= FULL_CONTEXT_TURNS) {
    return thread
      .map((item, idx) => {
        const answer = item.answer?.trim() || "(no answer)";
        const feedback = item.feedback?.trim() || "(no feedback)";
        return `Thread ${idx + 1}:\n- Question: ${item.question}\n- Answer: ${answer}\n- Feedback: ${feedback}\n- Result: ${item.result || "N/A"}`;
      })
      .join("\n");
  }

  // Compress older turns into a single line each to reduce input tokens (~40-60% savings
  // on long probe threads), then send the most recent turns in full.
  const oldTurns = thread.slice(0, -FULL_CONTEXT_TURNS);
  const recentTurns = thread.slice(-FULL_CONTEXT_TURNS);

  const compressedLines = oldTurns
    .map((item, idx) => {
      const feedbackSnippet = item.feedback?.trim().slice(0, 120) || "no feedback";
      return `Turn ${idx + 1} (${item.result || "N/A"}): ${feedbackSnippet}`;
    })
    .join("\n");

  const fullLines = recentTurns
    .map((item, idx) => {
      const answer = item.answer?.trim() || "(no answer)";
      const feedback = item.feedback?.trim() || "(no feedback)";
      const turnNum = oldTurns.length + idx + 1;
      return `Thread ${turnNum}:\n- Question: ${item.question}\n- Answer: ${answer}\n- Feedback: ${feedback}\n- Result: ${item.result || "N/A"}`;
    })
    .join("\n");

  return `[Earlier turns — compressed]\n${compressedLines}\n\n[Recent turns — full context]\n${fullLines}`;
}

export async function evaluateWithOpenAI(input: EvaluateInput): Promise<OpenAIEvaluation | null> {
  const pre = preEvaluate(input.studentAnswer);
  if (pre.skip) {
    return {
      result: pre.result,
      confidence: 0.9,
      feedback:
        pre.result === "FAIL"
          ? "Unsafe or incorrect reasoning detected. Review procedures and regulatory requirements before continuing."
          : "Your answer needs more depth. Provide a complete explanation including regulatory basis, procedures, and safety considerations.",
      missing_points: ["Complete explanation required"],
      probe_question: null,
      acs_task_code: input.acsTaskCode,
    };
  }

  const priorFollowUps = (input.priorFollowUps || []).filter(Boolean).slice(-3);
  const priorThread = (input.priorThread || []).slice(-3);
  const escalationLevel = Number.isFinite(input.escalationLevel) ? Number(input.escalationLevel) : 0;

  const threadContext = buildThreadContext(priorThread);

  const followUpsContext =
    priorFollowUps.length > 0
      ? priorFollowUps.map((q, idx) => `${idx + 1}. ${q}`).join("\n")
      : "None.";

  const wctx = input.weatherContext?.raw ? input.weatherContext : null;

  const weatherBlock = wctx
    ? `\nWeather context for this session:\nAirport: ${wctx.airport || "unknown"}\nAircraft: ${wctx.aircraft || "unknown"}\nCurrent conditions: ${wctx.raw}\nWind: ${wctx.wind || "N/A"} | Visibility: ${wctx.visibility || "N/A"} | Ceiling: ${wctx.ceiling || "N/A"}\n\nReference these conditions naturally in questions where it makes sense — e.g. asking about weather minimums, go/no-go decisions, alternate planning given today's actual ceiling and visibility.\n`
    : "";

  const scoringSystemPrompt = wctx ? SCORING_SYSTEM_PROMPT + WEATHER_SYSTEM_ADDENDUM : SCORING_SYSTEM_PROMPT;

  const mustIncludeBlock =
    input.mustInclude && input.mustInclude.length > 0
      ? `\nRequired points this answer MUST cover to pass:\n${input.mustInclude.map((p) => `- ${p}`).join("\n")}\n\nScore PASS only if the answer addresses ALL of these points.\nScore PROBE if 1-2 points are missing.\nScore REMEDIATE if 3 or more points are missing.\nScore FAIL only for dangerous or fundamentally wrong answers.\n`
      : "";

  const baseUserPrompt = `IMPORTANT: Read the student's complete answer carefully before scoring. Credit everything they said correctly. Only penalize genuine gaps.

${weatherBlock}Current examiner prompt: ${input.questionStem}
ACS task code: ${input.acsTaskCode}
Student answer: ${input.studentAnswer}
${mustIncludeBlock}Current escalation level: ${escalationLevel}
Prior thread context:
${threadContext}
Prior follow-up questions (do not repeat or paraphrase these):
${followUpsContext}`;

  // --- Call 1: Scoring only (EVAL_MODEL / nano) ---
  let scoringRaw: string;
  try {
    scoringRaw = await runOpenAIWithModel(
      [
        { role: "system", content: scoringSystemPrompt },
        { role: "user", content: baseUserPrompt },
      ],
      EVAL_MODEL,
      300,
      SCORING_SCHEMA,
      "oral_scoring"
    );
  } catch (err) {
    console.error("[evaluateWithOpenAI] scoring call failed:", err);
    return null;
  }

  let scoringParsed = parseScoringResult(scoringRaw);

  if (!scoringParsed) {
    // Retry fallback for Call 1 only
    try {
      scoringRaw = await runOpenAIWithModel(
        [
          { role: "system", content: scoringSystemPrompt },
          {
            role: "user",
            content:
              `Your previous output was invalid JSON for the required schema.\n` +
              `Fix it and return only valid JSON with the required keys.\n` +
              `Original context:\n${baseUserPrompt}\n\n` +
              `Invalid output to fix:\n${scoringRaw}`,
          },
        ],
        EVAL_MODEL,
        300,
        SCORING_SCHEMA,
        "oral_scoring"
      );
    } catch (err) {
      console.error("[evaluateWithOpenAI] scoring retry failed:", err);
      return null;
    }
    scoringParsed = parseScoringResult(scoringRaw);
  }

  if (!scoringParsed) return null;

  // Sanity check: detailed answers with regulatory references should never be FAIL
  if (scoringParsed.result === "FAIL") {
    const wordCount = input.studentAnswer.trim().split(/\s+/).length;
    const hasFARReference = /\b(far|14 cfr|91\.\d+|61\.\d+|aim)\b/i.test(input.studentAnswer);
    if (wordCount > 100 && hasFARReference) {
      scoringParsed.result = "PROBE";
      scoringParsed.confidence = Math.min(scoringParsed.confidence, 0.6);
      scoringParsed.feedback =
        scoringParsed.feedback + " Note: Answer contained regulatory references — review for completeness.";
    }
  }

  // --- Call 2: Probe question only (PROBE_MODEL / gpt-4.1) ---
  // Skip entirely when result is PASS
  let probe_question: string | null = null;

  if (scoringParsed.result !== "PASS") {
    const probeSystemPrompt = wctx ? PROBE_SYSTEM_PROMPT + WEATHER_SYSTEM_ADDENDUM : PROBE_SYSTEM_PROMPT;

    const probeUserPrompt = `${weatherBlock}Current examiner prompt: ${input.questionStem}
ACS task code: ${input.acsTaskCode}
Student answer: ${input.studentAnswer}
Scoring result: ${scoringParsed.result} (confidence: ${scoringParsed.confidence})
Identified gaps: ${scoringParsed.missing_points.join(", ") || "none"}
Prior follow-up questions (do not repeat or paraphrase these):
${followUpsContext}

Generate one scenario-based follow-up question that probes the student's weak areas.
If mastery is clearly demonstrated, return null.`;

    try {
      const probeRaw = await runOpenAIWithModel(
        [
          { role: "system", content: probeSystemPrompt },
          { role: "user", content: probeUserPrompt },
        ],
        PROBE_MODEL,
        150,
        PROBE_SCHEMA,
        "oral_probe"
      );
      probe_question = parseProbeResult(probeRaw);
    } catch (err) {
      console.error("[evaluateWithOpenAI] probe call failed:", err);
      // probe_question stays null — caller has a buildFallbackFollowUp fallback
    }
  }

  return {
    result: scoringParsed.result,
    confidence: scoringParsed.confidence,
    feedback: scoringParsed.feedback,
    missing_points: scoringParsed.missing_points,
    probe_question,
    acs_task_code: input.acsTaskCode,
  };
}

type ScoringResult = {
  result: EvaluationResultCode;
  confidence: number;
  feedback: string;
  missing_points: string[];
};

function parseScoringResult(jsonText: string): ScoringResult | null {
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    if (!isResult(parsed.result)) return null;
    if (typeof parsed.feedback !== "string") return null;
    if (!Array.isArray(parsed.missing_points)) return null;
    if (!parsed.missing_points.every((x) => typeof x === "string")) return null;

    const confidenceRaw =
      typeof parsed.confidence === "number" ? parsed.confidence : Number(parsed.confidence);

    return {
      result: parsed.result,
      confidence: clamp01(confidenceRaw),
      feedback: parsed.feedback.trim(),
      missing_points: parsed.missing_points.map((x) => x.trim()).filter(Boolean),
    };
  } catch {
    return null;
  }
}

function parseProbeResult(jsonText: string): string | null {
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    if (typeof parsed.probe_question === "string" && parsed.probe_question.trim()) {
      return parsed.probe_question.trim();
    }
    return null;
  } catch {
    return null;
  }
}

