import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { MySQLAdapter } from "@/lib/auth-adapter";
import { sendMagicLinkEmail } from "@/lib/email";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MySQLAdapter(),
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        (token as { id?: string }).id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id =
          (token as { id?: string })?.id || token?.sub || undefined;
      }
      return session;
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: "ProCheckride <noreply@procheckride.com>",
      allowDangerousEmailAccountLinking: true,
      async sendVerificationRequest({ identifier, url }) {
        const result = await sendMagicLinkEmail({ to: identifier, url });
        if (!result.success) {
          throw new Error(result.error || "Failed to send magic link email");
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
});
