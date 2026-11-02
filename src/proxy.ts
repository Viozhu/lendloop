import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 renamed middleware to proxy. Clerk deprecated route matching here in
// favour of checks next to the resource: (app)/layout.tsx calls auth.protect()
// and every Convex function authorizes on its own. This proxy only attaches the
// Clerk session to the request.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
