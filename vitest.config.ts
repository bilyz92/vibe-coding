import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `npm run build` emits compiled *.test.js into dist/; running those too
    // doubles the suite and runs stale code.
    exclude: [...configDefaults.exclude, "dist/**"],
  },
});
