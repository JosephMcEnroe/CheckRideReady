import OpenAI, { toFile } from "openai";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — Whisper hard limit

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audioFile = formData.get("audio");
  if (!(audioFile instanceof Blob)) {
    return Response.json({ error: "Missing audio field" }, { status: 400 });
  }

  if (audioFile.size > MAX_BYTES) {
    return Response.json({ error: "Audio file exceeds 25 MB limit" }, { status: 413 });
  }

  try {
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(audioBuffer, "audio.webm", { type: "audio/webm" }),
      model: "whisper-1",
      language: "en",
      prompt:
        "This is a student pilot answering FAA oral exam questions about aviation, regulations, weather, airspace, and flight procedures.",
    });

    return Response.json({ text: transcription.text });
  } catch (err: any) {
    const message = err?.message || "Transcription failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
