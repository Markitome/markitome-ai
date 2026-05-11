import { isMarkitomeEmail } from "@markitome/auth";
import { prisma } from "@markitome/db";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

async function isAllowlisted(email: string) {
  if (isMarkitomeEmail(email)) {
    return true;
  }

  const allowlistRecord = await prisma.approvedEmailAllowlist
    .findUnique({ where: { email: email.toLowerCase() } })
    .catch(() => null);

  return Boolean(allowlistRecord);
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

      const picture = profile && "picture" in profile ? String(profile.picture ?? "") : undefined;

      const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
      const defaultRoleName = email === initialAdminEmail ? "ADMIN" : "TEAM_MEMBER";

      const role = await prisma.role.upsert({
        where: { name: defaultRoleName },
        update: {},
        create: { name: defaultRoleName, description: `${defaultRoleName} bootstrap role` }
      });

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: profile?.name,
          image: picture,
          googleSubject: profile?.sub
        },
        create: {
          email,
          name: profile?.name,
          image: picture,
          googleSubject: profile?.sub,
          roles: {
            create: { roleId: role.id }
          }
        },
        include: { roles: true }
      });

      if (user.roles.length === 0) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: role.id }
        });
      }

      await prisma.auditLog
        .create({
          data: { actorUserId: user.id, action: "LOGIN", resource: "auth" }
        })
        .catch(() => undefined);

      return true;
    },
    async jwt({ token }) {
      if (token.email) {
        const user = await prisma.user.findUnique({
          where: { email: token.email.toLowerCase() },
          include: { roles: { include: { role: true } } }
        }).catch(() => null);

        token.sub = user?.id ?? token.sub;
        token.roles = user?.roles.map((userRole) => userRole.role.name) ?? ["TEAM_MEMBER"];
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
