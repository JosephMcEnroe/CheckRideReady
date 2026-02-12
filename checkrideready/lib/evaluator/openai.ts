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
};

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You are an FAA DPE-style oral evaluator.
Evaluate only this answer against this question and ACS task.
Grade for structure, regulatory/source correctness, and safety/risk emphasis.
Return ONLY valid JSON. No markdown. No extra keys.

Required JSON:
{
  "result": "PASS" | "PROBE" | "REMEDIATE" | "FAIL",
  "confidence": number between 0 and 1,
  "feedback": string,
  "missing_points": string[],
  "probe_question": string | null,
  "acs_task_code": string
}`;

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
      typeof parsed.confidence === "number"
        ? parsed.confidence
        : Number(parsed.confidence);

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

async function runOpenAI(messages: Array<{ role: "system" | "user"; content: string }>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "oral_evaluation",
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "result",
              "confidence",
              "feedback",
              "missing_points",
              "probe_question",
              "acs_task_code",
            ],
            properties: {
              result: {
                type: "string",
                enum: ["PASS", "PROBE", "REMEDIATE", "FAIL"],
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              feedback: { type: "string" },
              missing_points: {
                type: "array",
                items: { type: "string" },
              },
              probe_question: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              acs_task_code: { type: "string" },
            },
          },
        },
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    throw new Error(payload?.error?.message || "OpenAI request failed");
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI returned empty content");
  }

  return content;
}

export async function evaluateWithOpenAI(input: EvaluateInput): Promise<OpenAIEvaluation | null> {
  const baseUserPrompt = `Question stem: ${input.questionStem}
ACS task code: ${input.acsTaskCode}
Student answer: ${input.studentAnswer}`;

  let raw = await runOpenAI([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: baseUserPrompt },
  ]);

  let parsed = parseEvaluation(raw);
  if (parsed) {
    return { ...parsed, acs_task_code: input.acsTaskCode };
  }

  for (let i = 0; i < 2; i++) {
    raw = await runOpenAI([
      { role: "system", content: SYSTEM_PROMPT },
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
  }

  return null;
}
