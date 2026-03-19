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

const MODEL = process.env.OPENAI_EVAL_MODEL || "gpt-4.1";

const WEATHER_SYSTEM_ADDENDUM = `\nIf weather context is provided below, reference today's actual conditions naturally in your questions where relevant. Ask scenario-based questions that a real DPE would ask given these specific conditions.`;

// JSON schema instructions removed — structured output enforces the schema automatically.
const SYSTEM_PROMPT = `You are an FAA DPE-style oral examiner for an interactive oral exam thread.
Evaluate the current student answer against the current examiner prompt and ACS task.
Analyze strengths, weak areas, missed details, shallow reasoning, risk areas, regulatory gaps, and decision quality.
Then generate one targeted examiner follow-up question that probes weakness and slightly increases difficulty.
Follow-up must be specific, scenario-based when appropriate, and non-repetitive with prior follow-ups.
Never end with praise-only response. Never summarize and stop unless mastery is clear.`;

// Strict schema used with OpenAI structured outputs (strict: true).
// Note: minimum/maximum are not supported in strict mode — confidence is validated in parseEvaluation.
const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["result", "confidence", "feedback", "missing_points", "probe_question", "acs_task_code"],
  properties: {
    result: { type: "string", enum: ["PASS", "PROBE", "REMEDIATE", "FAIL"] },
    confidence: { type: "number" },
    feedback: { type: "string" },
    missing_points: { type: "array", items: { type: "string" } },
    probe_question: { anyOf: [{ type: "string" }, { type: "null" }] },
    acs_task_code: { type: "string" },
  },
};

function isResult(v: unknown): v is EvaluationResultCode {
  return v === "PASS" || v === "PROBE" || v === "REMEDIATE" || v === "FAIL";
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function parseEvaluation(jsonText: string): OpenAIEvaluation | null {
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    if (!isResult(parsed.result)) return null;
    if (typeof parsed.feedback !== "string") return null;
    if (!Array.isArray(parsed.missing_points)) return null;
    if (!parsed.missing_points.every((x) => typeof x === "string")) return null;
    if (!(typeof parsed.probe_question === "string" || parsed.probe_question === null)) return null;
    if (typeof parsed.acs_task_code !== "string") return null;

    const confidenceRaw =
      typeof parsed.confidence === "number" ? parsed.confidence : Number(parsed.confidence);

    return {
      result: parsed.result,
      confidence: clamp01(confidenceRaw),
      feedback: parsed.feedback.trim(),
      missing_points: parsed.missing_points.map((x) => x.trim()).filter(Boolean),
      probe_question:
        typeof parsed.probe_question === "string" && parsed.probe_question.trim()
          ? parsed.probe_question.trim()
          : null,
      acs_task_code: parsed.acs_task_code.trim(),
    };
  } catch {
    return null;
  }
}

// Uses the singleton OpenAI SDK client so the underlying HTTP/2 connection is reused
// across requests (avoids per-call TCP+TLS handshake overhead).
// max_completion_tokens: 800 — caps response length; the JSON schema is compact and never needs more.
async function runOpenAI(messages: Array<{ role: "system" | "user"; content: string }>) {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
    max_completion_tokens: 800,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "oral_evaluation",
        schema: RESPONSE_SCHEMA,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI returned empty content");
  }

  return content;
}

// How many recent turns to keep in full — older turns beyond this are compressed.
const FULL_CONTEXT_TURNS = 3;

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
  const priorFollowUps = (input.priorFollowUps || []).filter(Boolean).slice(-6);
  const priorThread = (input.priorThread || []).slice(-6);
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

  const systemPrompt = wctx ? SYSTEM_PROMPT + WEATHER_SYSTEM_ADDENDUM : SYSTEM_PROMPT;

  const baseUserPrompt = `${weatherBlock}Current examiner prompt: ${input.questionStem}
ACS task code: ${input.acsTaskCode}
Student answer: ${input.studentAnswer}
Current escalation level: ${escalationLevel}
Prior thread context:
${threadContext}
Prior follow-up questions (do not repeat or paraphrase these):
${followUpsContext}

Rules for probe_question:
- Return a single follow-up examiner question unless mastery is clearly demonstrated.
- If mastery is clearly demonstrated, you may return null.
- If returning a question, it must be targeted and harder than the current prompt.`;

  let raw = await runOpenAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: baseUserPrompt },
  ]);

  let parsed = parseEvaluation(raw);
  if (parsed) {
    return { ...parsed, acs_task_code: input.acsTaskCode };
  }

  // strict: true should make this retry path unreachable in practice,
  // but keep one fallback in case of transient model errors.
  raw = await runOpenAI([
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content:
        `Your previous output was invalid JSON for the required schema.\n` +
        `Fix it and return only valid JSON with the required keys.\n` +
        `Original context:\n${baseUserPrompt}\n\n` +
        `Invalid output to fix:\n${raw}`,
    },
  ]);
  parsed = parseEvaluation(raw);
  if (parsed) {
    return { ...parsed, acs_task_code: input.acsTaskCode };
  }

  return null;
}
