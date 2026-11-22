import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `npm run build` emits compiled *.test.js into dist/; running those too
    // doubles the suite and runs stale code. claude-skills/ is a mirror of the skills repo
    // whose *.test.mjs files use node:test, not Vitest.
    exclude: [...configDefaults.exclude, "dist/**", "claude-skills/**"],
  },
});
