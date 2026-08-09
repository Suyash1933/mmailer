export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/templates/:path*", "/campaigns/:path*", "/settings/:path*"],
};
