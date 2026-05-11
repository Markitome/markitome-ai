import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login"
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/proposal-builder/:path*",
    "/chat/:path*",
    "/blog-writer/:path*",
    "/presentation-builder/:path*",
    "/image-studio/:path*",
    "/email-assistant/:path*",
    "/knowledge-base/:path*",
    "/admin/:path*"
  ]
};
