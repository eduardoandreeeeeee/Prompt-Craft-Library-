import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: { obsidian: resolve(__dirname, "tests/stubs/obsidian.ts") },
	},
});
