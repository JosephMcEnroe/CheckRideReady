import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInviteEmail({
  to,
  invitedBy,
  schoolName,
  role,
  inviteUrl,
}: {
  to: string;
  invitedBy: string;
  schoolName: string;
  role: "instructor" | "student";
  inviteUrl: string;
}) {
  const roleLabel = role === "instructor" ? "Flight Instructor" : "Student";

  try {
    const { error } = await resend.emails.send({
      from: `CheckRideReady <${process.env.EMAIL_FROM || "onboarding@resend.dev"}>`,
      to,
      subject: `You've been invited to join ${schoolName} on CheckRideReady`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1e3a5f;">You're invited to CheckRideReady</h2>
          <p>${invitedBy} has invited you to join <strong>${schoolName}</strong> as a <strong>${roleLabel}</strong>.</p>
          <p>Click the button below to accept your invitation and get started:</p>
          <a href="${inviteUrl}"
             style="display: inline-block; background: #ff6b35; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
            Accept Invitation
          </a>
          <p style="color: #6c757d; font-size: 13px;">This invite expires in 7 days. If you didn't expect this email, you can ignore it.</p>
        </div>
      `,
    });

    if (error) {
      console.log("Email send error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.log("Email send exception:", err);
    return null;
  }
}