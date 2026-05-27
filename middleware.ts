// middleware.ts
// Next.js middleware — runs on every matched request before the page renders.
// Protects authenticated routes by redirecting unauthenticated users to /signin.

export { auth as default } from "@/lib/auth";

export const config = {
  matcher: [
    // Protect dashboard and room routes
    "/dashboard/:path*",
    "/room/:path*",
    // Exclude public routes, static files, and NextAuth internals
    "/((?!api/auth|signin|signup|_next/static|_next/image|favicon.ico|$).*)",
  ],
};
