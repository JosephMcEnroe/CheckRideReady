import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { pool } from "@/lib/db";
import { computeOverallGrade } from "@/lib/session-grading";
import { Buffer } from "node:buffer";
import { auth } from "@/auth";

export const runtime = "nodejs";

type SessionRow = {
  id: string;
  user_id: string;
  mode: string | null;
  status: string | null;
  started_at: string | Date | null;
  ended_at: string | Date | null;
  overall_grade: "PASS" | "PROBE" | "REMEDIATE" | "FAIL" | null;
  overall_summary: string | null;
};

type QuestionRow = {
  id: number;
  acs_task: string | null;
  question_text: string | null;
  user_answer: string | null;
  ai_feedback: string | null;
  result: "PASS" | "PROBE" | "REMEDIATE" | "FAIL" | null;
  created_at: string | Date | null;
};

type PageState = {
  page: PDFPage;
  y: number;
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Not available";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function resultColor(result: string | null | undefined) {
  if (result === "PASS") return rgb(0.04, 0.48, 0.2);
  if (result === "PROBE") return rgb(0.92, 0.62, 0.05);
  if (result === "REMEDIATE") return rgb(0.75, 0.22, 0.22);
  if (result === "FAIL") return rgb(0.62, 0.1, 0.1);
  return rgb(0.3, 0.3, 0.3);
}

export async function GET(
  _req: Request,
  context: { params: { sessionId: string } | Promise<{ sessionId: string }> }
) {
  const resolvedParams = await Promise.resolve(context.params);
  const { sessionId } = resolvedParams;
  if (!sessionId) {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
    const authSession = await auth();
    const userId = (authSession?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [sessionRows] = await pool.execute(
      `SELECT id, user_id, mode, status, started_at, ended_at, overall_grade, overall_summary
       FROM oral_sessions
       WHERE id = ?
         AND user_id = ?
       LIMIT 1`,
      [sessionId, userId]
    );
    const session = (sessionRows as SessionRow[])[0];

    if (!session) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const [questionRows] = await pool.execute(
      `SELECT id, acs_task, question_text, user_answer, ai_feedback, result, created_at
       FROM session_questions
       WHERE session_id = ?
       ORDER BY created_at ASC, id ASC`,
      [sessionId]
    );
    const questions = questionRows as QuestionRow[];

    // Optional metadata support: include applicant name if schema has it.
    const [columnRows] = await pool.execute(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'oral_sessions'
         AND COLUMN_NAME IN ('applicant_name', 'applicant')`
    );

    const availableColumns = new Set(
      (columnRows as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME)
    );
    let applicantName = "Not provided";

    if (availableColumns.has("applicant_name")) {
      const [rows] = await pool.execute(
        "SELECT applicant_name AS applicantName FROM oral_sessions WHERE id = ? AND user_id = ? LIMIT 1",
        [sessionId, userId]
      );
      const value = (rows as Array<{ applicantName?: string | null }>)[0]?.applicantName;
      if (value?.trim()) applicantName = value.trim();
    } else if (availableColumns.has("applicant")) {
      const [rows] = await pool.execute(
        "SELECT applicant AS applicantName FROM oral_sessions WHERE id = ? AND user_id = ? LIMIT 1",
        [sessionId, userId]
      );
      const value = (rows as Array<{ applicantName?: string | null }>)[0]?.applicantName;
      if (value?.trim()) applicantName = value.trim();
    }

    const counts = {
      passCount: questions.filter((q) => q.result === "PASS").length,
      probeCount: questions.filter((q) => q.result === "PROBE").length,
      remediateCount: questions.filter((q) => q.result === "REMEDIATE").length,
      failCount: questions.filter((q) => q.result === "FAIL").length,
    };
    const overallResult =
      session.overall_grade ||
      computeOverallGrade({
        passCount: counts.passCount,
        probeCount: counts.probeCount,
        remediateCount: counts.remediateCount,
        failCount: counts.failCount,
      });

    const pdf = await PDFDocument.create();
    const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612;
    const pageHeight = 792;
    const marginX = 50;
    const headerY = pageHeight - 28;
    const topContentY = pageHeight - 64;
    const bottomContentY = 48;
    const generatedLabel = `Generated on ${new Date().toLocaleString()}`;

    // Layout strategy:
    // - The report is built line-by-line with wrapped text blocks.
    // - Before each block, we check available vertical space and create a new page if needed.
    // - Every page gets a consistent header and footer for a professional printable report.
    function addPage(): PageState {
      const page = pdf.addPage([pageWidth, pageHeight]);
      page.drawText("ProCheckride | Oral Exam Report", {
        x: marginX,
        y: headerY,
        size: 10,
        font: fontBold,
        color: rgb(0.17, 0.2, 0.25),
      });
      page.drawLine({
        start: { x: marginX, y: headerY - 6 },
        end: { x: pageWidth - marginX, y: headerY - 6 },
        thickness: 0.8,
        color: rgb(0.82, 0.84, 0.88),
      });
      page.drawLine({
        start: { x: marginX, y: bottomContentY - 8 },
        end: { x: pageWidth - marginX, y: bottomContentY - 8 },
        thickness: 0.6,
        color: rgb(0.86, 0.88, 0.9),
      });
      page.drawText(generatedLabel, {
        x: marginX,
        y: bottomContentY - 22,
        size: 9,
        font: fontRegular,
        color: rgb(0.35, 0.37, 0.42),
      });
      return { page, y: topContentY };
    }

    const maxTextWidth = pageWidth - marginX * 2;
    let state = addPage();

    function ensureSpace(requiredHeight: number) {
      if (state.y - requiredHeight < bottomContentY + 8) {
        state = addPage();
      }
    }

    function drawTextLine(
      text: string,
      options?: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number }
    ) {
      const size = options?.size ?? 11;
      const font = options?.font ?? fontRegular;
      const color = options?.color ?? rgb(0.1, 0.1, 0.1);
      const gap = options?.gap ?? 4;

      ensureSpace(size + gap);
      state.page.drawText(text, { x: marginX, y: state.y, size, font, color });
      state.y -= size + gap;
    }

    function drawWrappedBlock(
      text: string,
      options?: {
        font?: PDFFont;
        size?: number;
        color?: ReturnType<typeof rgb>;
        lineGap?: number;
        blockGap?: number;
      }
    ) {
      const font = options?.font ?? fontRegular;
      const size = options?.size ?? 11;
      const color = options?.color ?? rgb(0.1, 0.1, 0.1);
      const lineGap = options?.lineGap ?? 3;
      const blockGap = options?.blockGap ?? 8;

      const paragraphs = (text || "").split("\n");
      for (const paragraph of paragraphs) {
        const words = paragraph.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) {
          ensureSpace(size + lineGap);
          state.y -= size + lineGap;
          continue;
        }

        let line = "";
        for (const word of words) {
          const next = line ? `${line} ${word}` : word;
          const width = font.widthOfTextAtSize(next, size);
          if (width <= maxTextWidth) {
            line = next;
            continue;
          }

          ensureSpace(size + lineGap);
          state.page.drawText(line, { x: marginX, y: state.y, size, font, color });
          state.y -= size + lineGap;
          line = word;
        }

        if (line) {
          ensureSpace(size + lineGap);
          state.page.drawText(line, { x: marginX, y: state.y, size, font, color });
          state.y -= size + lineGap;
        }
      }

      state.y -= blockGap;
    }

    function drawSectionDivider() {
      ensureSpace(14);
      state.page.drawLine({
        start: { x: marginX, y: state.y },
        end: { x: pageWidth - marginX, y: state.y },
        thickness: 0.7,
        color: rgb(0.86, 0.88, 0.9),
      });
      state.y -= 12;
    }

    drawTextLine("ProCheckride Oral Exam Report", {
      font: fontBold,
      size: 20,
      color: rgb(0.08, 0.11, 0.18),
      gap: 8,
    });
    drawTextLine("Private Pilot Oral Examination", {
      font: fontRegular,
      size: 12,
      color: rgb(0.24, 0.28, 0.35),
      gap: 14,
    });

    drawSectionDivider();
    drawTextLine(`Session ID: ${session.id}`, { font: fontRegular, size: 10, color: rgb(0.3, 0.34, 0.4) });
    drawTextLine(`Session Date: ${formatDate(session.started_at)}`, {
      font: fontRegular,
      size: 10,
      color: rgb(0.3, 0.34, 0.4),
    });
    drawTextLine(`Applicant: ${applicantName}`, { font: fontRegular, size: 10, color: rgb(0.3, 0.34, 0.4) });
    drawTextLine(`Session Type: ${session.mode || "Not specified"}`, {
      font: fontRegular,
      size: 10,
      color: rgb(0.3, 0.34, 0.4),
    });
    drawTextLine(`Status: ${session.status || "Unknown"}`, { font: fontRegular, size: 10, color: rgb(0.3, 0.34, 0.4) });
    state.y -= 4;

    ensureSpace(24);
    state.page.drawRectangle({
      x: marginX,
      y: state.y - 4,
      width: 190,
      height: 20,
      color: rgb(0.95, 0.96, 0.98),
      borderColor: resultColor(overallResult),
      borderWidth: 1.2,
    });
    state.page.drawText(`Result: ${overallResult}`, {
      x: marginX + 10,
      y: state.y + 2,
      size: 11,
      font: fontBold,
      color: resultColor(overallResult),
    });
    state.y -= 30;

    drawTextLine("Overall Notes", { font: fontBold, size: 12, color: rgb(0.1, 0.13, 0.2), gap: 5 });
    drawWrappedBlock(session.overall_summary || "No overall notes recorded for this session yet.", {
      font: fontRegular,
      size: 11,
      color: rgb(0.14, 0.16, 0.2),
      lineGap: 3,
      blockGap: 10,
    });

    drawSectionDivider();
    drawTextLine("Question Review", { font: fontBold, size: 13, color: rgb(0.1, 0.13, 0.2), gap: 8 });

    if (questions.length === 0) {
      drawWrappedBlock(
        "Session incomplete: no question responses were found. Continue the session to generate a full debrief report.",
        {
          font: fontRegular,
          size: 11,
          color: rgb(0.22, 0.24, 0.28),
          lineGap: 3,
          blockGap: 8,
        }
      );
    } else {
      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        const number = idx + 1;
        const qResult = q.result || "N/A";

        drawSectionDivider();
        drawTextLine(`Question ${number}`, { font: fontBold, size: 12, color: rgb(0.09, 0.12, 0.18), gap: 4 });
        drawTextLine(`ACS Task: ${q.acs_task || "N/A"}   |   Result: ${qResult}`, {
          font: fontRegular,
          size: 10,
          color: rgb(0.33, 0.36, 0.42),
          gap: 8,
        });

        drawTextLine("Question:", { font: fontBold, size: 10, color: rgb(0.12, 0.14, 0.2), gap: 3 });
        drawWrappedBlock(q.question_text || "No question text available.", {
          font: fontRegular,
          size: 10.5,
          color: rgb(0.12, 0.13, 0.17),
          lineGap: 3,
          blockGap: 4,
        });

        drawTextLine("Student Response:", { font: fontBold, size: 10, color: rgb(0.12, 0.14, 0.2), gap: 3 });
        drawWrappedBlock(q.user_answer || "No response provided.", {
          font: fontRegular,
          size: 10.5,
          color: rgb(0.12, 0.13, 0.17),
          lineGap: 3,
          blockGap: 4,
        });

        drawTextLine("Evaluator Feedback:", { font: fontBold, size: 10, color: rgb(0.12, 0.14, 0.2), gap: 3 });
        drawWrappedBlock(q.ai_feedback || "No evaluator feedback available.", {
          font: fontRegular,
          size: 10.5,
          color: rgb(0.12, 0.13, 0.17),
          lineGap: 3,
          blockGap: 6,
        });
      }
    }

    const bytes = await pdf.save();
    const body = Buffer.from(bytes);
    const filename = `ProCheckride-Session-${sessionId}.pdf`;

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate PDF report";
    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}

