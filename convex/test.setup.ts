/// <reference types="vite/client" />

// Every Convex module, for convexTest(). The extglob from the Convex docs is not
// supported by the installed Vite, so exclusions are listed explicitly.
export const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.d.ts",
  "!./**/*.test.ts",
  "!./test.setup.ts",
]);
