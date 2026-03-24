import { getOpenAIClient } from "@/lib/openai";

export async function generateScenarioQuestion(input: {
  airport: string;
  aircraft: string;
  mode: "PPL" | "IR" | "CPL";
  weather: { raw?: string; wind?: string; visibility?: string; ceiling?: string };
  focusAreas?: string[];
  recentTaskCodes?: string[];
}): Promise<{ stem: string; acs_task_code: string; acs_area: string; is_scenario: true } | null> {
  try {
    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || "gpt-4.1";

    const focusLine =
      input.focusAreas && input.focusAreas.length > 0
        ? `Focus areas: ${input.focusAreas.join(", ")}`
        : "";
    const avoidLine =
      input.recentTaskCodes && input.recentTaskCodes.length > 0
        ? `Avoid these task codes already used: ${input.recentTaskCodes.join(", ")}`
        : "";

    const userPrompt = [
      `Certificate: ${input.mode}`,
      `Aircraft: ${input.aircraft}`,
      `Airport: ${input.airport}`,
      `Current METAR: ${input.weather.raw || "unavailable"}`,
      `Wind: ${input.weather.wind || "unknown"} | Visibility: ${input.weather.visibility || "unknown"} | Ceiling: ${input.weather.ceiling || "unknown"}`,
      focusLine,
      avoidLine,
      "",
      `Generate one scenario question that feels like a real DPE sitting across from the student at ${input.airport} right now.`,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.chat.completions.create({
      model,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `You are an FAA Designated Pilot Examiner generating a single oral exam scenario question. Generate ONE scenario question that:
- References today's ACTUAL weather conditions naturally
- Is specific to the student's aircraft and its limitations
- Tests applied knowledge not definitions
- Forces a real decision: go/no-go, emergency action, regulatory compliance
- Is phrased from the examiner perspective: 'You are...', 'Walk me through...', 'Given that...'
- Is 1-3 sentences maximum
- Is NOT a yes/no question
Never ask the student to define or recite — ask them to APPLY knowledge in a real scenario using today's actual conditions.`,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scenario_question",
          strict: true,
          schema: {
            type: "object",
            properties: {
              stem: { type: "string" },
              acs_task_code: { type: "string" },
              acs_area: { type: "string" },
            },
            required: ["stem", "acs_task_code", "acs_area"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { stem: string; acs_task_code: string; acs_area: string };
    if (!parsed.stem || !parsed.acs_task_code || !parsed.acs_area) return null;

    return {
      stem: parsed.stem,
      acs_task_code: parsed.acs_task_code,
      acs_area: parsed.acs_area,
      is_scenario: true,
    };
  } catch {
    return null;
  }
}
