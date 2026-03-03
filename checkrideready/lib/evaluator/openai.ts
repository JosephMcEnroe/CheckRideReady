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
};

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You are an FAA DPE-style oral examiner for an interactive oral exam thread.
Evaluate the current student answer against the current examiner prompt and ACS task.
Analyze strengths, weak areas, missed details, shallow reasoning, risk areas, regulatory gaps, and decision quality.
Then generate one targeted examiner follow-up question that probes weakness and slightly increases difficulty.
Follow-up must be specific, scenario-based when appropriate, and non-repetitive with prior follow-ups.
Never end with praise-only response. Never summarize and stop unless mastery is clear.
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
  const priorFollowUps = (input.priorFollowUps || []).filter(Boolean).slice(-6);
  const priorThread = (input.priorThread || []).slice(-6);
  const escalationLevel = Number.isFinite(input.escalationLevel) ? Number(input.escalationLevel) : 0;

  const threadContext =
    priorThread.length > 0
      ? priorThread
          .map((item, idx) => {
            const answer = item.answer?.trim() || "(no answer)";
            const feedback = item.feedback?.trim() || "(no feedback)";
            return `Thread ${idx + 1}:
- Question: ${item.question}
- Answer: ${answer}
- Feedback: ${feedback}
- Result: ${item.result || "N/A"}`;
          })
          .join("\n")
      : "No prior thread items.";

  const followUpsContext =
    priorFollowUps.length > 0
      ? priorFollowUps.map((q, idx) => `${idx + 1}. ${q}`).join("\n")
      : "None.";

  const baseUserPrompt = `Current examiner prompt: ${input.questionStem}
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
