import { OPENAI_MODEL, getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";

function textResponse(message: string, status: number) {
  return new Response(`${message}\n`, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return textResponse("Invalid request: prompt is required.", 400);
  }

  let stream: AsyncIterable<any> & { return?: () => Promise<any> };
  try {
    const client = getOpenAIClient();
    stream = (await client.responses.create(
      {
        model: OPENAI_MODEL,
        input: prompt,
        stream: true,
      },
      { signal: req.signal }
    )) as AsyncIterable<any> & { return?: () => Promise<any> };
  } catch (error: any) {
    const message = error?.message || "OpenAI request failed";
    return textResponse(`Unable to start stream: ${message}`, 502);
  }

  const encoder = new TextEncoder();

  // Streams plain text deltas to the client as they arrive.
  // To switch to SSE later, wrap each chunk as: `data: <chunk>\n\n`.
  const bodyStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const closeOnce = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      const abortFromClient = () => {
        if (typeof stream?.return === "function") {
          void stream.return();
        }
      };

      req.signal.addEventListener("abort", abortFromClient);

      try {
        for await (const event of stream) {
          if (req.signal.aborted) break;

          if (event?.type === "response.output_text.delta" && typeof event.delta === "string") {
            controller.enqueue(encoder.encode(event.delta));
            continue;
          }

          if (event?.type === "error") {
            const message = event?.error?.message || "OpenAI streaming error";
            controller.enqueue(encoder.encode(`\n[stream error] ${message}`));
            break;
          }
        }
      } catch (error: any) {
        if (!req.signal.aborted) {
          const message = error?.message || "Streaming interrupted";
          controller.enqueue(encoder.encode(`\n[stream error] ${message}`));
        }
      } finally {
        req.signal.removeEventListener("abort", abortFromClient);
        closeOnce();
      }
    },
  });

  return new Response(bodyStream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
