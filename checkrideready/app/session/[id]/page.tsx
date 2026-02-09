"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Question = {
  id: string;
  stem: string;
  acs_task_code: string;
  acs_area: string;
};

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);

  async function fetchNextQuestion() {
    if (!sessionId) {
      setError("Missing sessionId");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/session/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch next question");

      setQuestion(data.question);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionId) fetchNextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Oral Session</h1>
      <p style={{ opacity: 0.8, marginTop: 6 }}>
        Session: <code>{sessionId || "(loading...)"}</code>
      </p>

      <div style={{ marginTop: 24, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        {loading && <p>Loading next question...</p>}

        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

        {!loading && !error && question && (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ padding: "4px 10px", border: "1px solid #ccc", borderRadius: 999 }}>
                {question.acs_task_code}
              </span>
              <span style={{ padding: "4px 10px", border: "1px solid #ccc", borderRadius: 999 }}>
                {question.acs_area}
              </span>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Question</h2>
            <p style={{ lineHeight: 1.6 }}>{question.stem}</p>
          </>
        )}

        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
          <button
            onClick={fetchNextQuestion}
            disabled={loading || !sessionId}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #333",
              background: loading ? "#eee" : "#fff",
              cursor: loading || !sessionId ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            Next Question
          </button>

          <a href="/start" style={{ alignSelf: "center", opacity: 0.8, textDecoration: "underline" }}>
            Back to mode select
          </a>
        </div>
      </div>
    </main>
  );
}
