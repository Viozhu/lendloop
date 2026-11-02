import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Matches the Convex runtime more closely than Node.
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
