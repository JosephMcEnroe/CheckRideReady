import { getSessionResults } from "@/lib/session-results";
import { auth } from "@/auth";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return Response.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const authSession = await auth();
    const userId = (authSession?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getSessionResults(sessionId, userId);
    if (!payload) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json(payload);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Results API crashed";
    return Response.json({ error: message }, { status: 500 });
  }
}
