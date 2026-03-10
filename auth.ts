import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        (token as { id?: string }).id = user.id;
      }
      return token;
    },
    session({ session, user, token }) {
      if (session.user) {
        (session.user as { id?: string }).id =
          user?.id || (token as { id?: string })?.id || token?.sub || undefined;
      }
      return session;
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/login",
  },
});
