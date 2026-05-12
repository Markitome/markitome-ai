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
          access_type: "offline",
          prompt: "consent",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/documents"
          ].join(" ")
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
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.googleAccessToken = account.access_token;
        token.googleRefreshToken = account.refresh_token ?? token.googleRefreshToken;
        token.googleAccessTokenExpiresAt = account.expires_at ? account.expires_at * 1000 : undefined;
      }

      if (
        token.googleRefreshToken &&
        token.googleAccessTokenExpiresAt &&
        Date.now() > Number(token.googleAccessTokenExpiresAt) - 60_000
      ) {
        const refreshed = await refreshGoogleAccessToken(String(token.googleRefreshToken));
        if (refreshed.accessToken) {
          token.googleAccessToken = refreshed.accessToken;
          token.googleAccessTokenExpiresAt = refreshed.expiresAt;
        }
      }

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

async function refreshGoogleAccessToken(refreshToken: string) {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: refreshToken
      })
    });

    if (!response.ok) return {};
    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    return {
      accessToken: payload.access_token,
      expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : undefined
    };
  } catch {
    return {};
  }
}
