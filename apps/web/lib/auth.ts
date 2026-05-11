import { isMarkitomeEmail } from "@markitome/auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

async function isAllowlisted(email: string) {
  if (isMarkitomeEmail(email)) {
    return true;
  }

  const allowlist = process.env.APPROVED_EMAIL_ALLOWLIST ?? "";
  return allowlist
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid email profile"
        }
      }
    })
  ],
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email || !(await isAllowlisted(email))) {
        return false;
      }

      return true;
    },
    async jwt({ token }) {
      if (token.email) {
        const email = token.email.toLowerCase();
        const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
        token.sub = token.sub ?? email;
        token.roles = email === initialAdminEmail ? ["ADMIN"] : ["TEAM_MEMBER"];
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roles = (token.roles as string[] | undefined) ?? ["TEAM_MEMBER"];
      }

      return session;
    }
  },
  pages: {
    signIn: "/login",
    error: "/login"
  }
};
