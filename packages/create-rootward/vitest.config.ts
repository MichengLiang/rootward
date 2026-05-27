import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 120_000,
    exclude: ["templates/**", "dist/**", "temporary/**", "node_modules/**"],
  },
});
