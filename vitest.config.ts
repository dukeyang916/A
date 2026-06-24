import path from "node:path";
import { defineConfig } from "vite";

// Separate from vite.config.ts on purpose: the uni() plugin transforms
// page/component files for the mini-program runtime and isn't needed
// (and can interfere) when unit-testing plain TS logic like settlement.ts.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.spec.ts"],
  },
});
