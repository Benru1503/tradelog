import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    css: false,
    // `.claude/worktrees/**` holds full checkouts of this repo. Without it,
    // a bare `vitest run` from the root collects every suite twice and tries
    // to load the nested copy's Playwright specs as unit tests.
    exclude: [
      ...configDefaults.exclude,
      ".next",
      "tests/e2e/**",
      "playwright-report/**",
      "**/.claude/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["**/*.config.*", "**/node_modules/**", "tests/e2e/**", ".next/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
