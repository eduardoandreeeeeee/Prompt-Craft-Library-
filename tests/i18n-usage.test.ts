import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hasKey } from "../src/i18n";

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name === "locales" ? [] : sourceFiles(path);
		return path.endsWith(".ts") ? [path] : [];
	});
}

describe("uso de textos traducibles", () => {
	const files = sourceFiles(join(__dirname, "..", "src"));

	it("toda clave escrita como texto literal en t(...) existe en español", () => {
		const missing: string[] = [];
		for (const file of files) {
			const code = readFileSync(file, "utf8");
			for (const match of code.matchAll(/\bt\(\s*"([a-zA-Z0-9_.+-]+)"/g)) {
				if (!hasKey(match[1])) missing.push(`${file.split("/src/")[1]}: ${match[1]}`);
			}
		}
		expect(missing).toEqual([]);
	});

	it("las claves construidas con una variable existen para todos sus valores", () => {
		const groups: Record<string, string[]> = {
			"form.el.": ["rol", "contexto", "tarea", "formato", "restricciones"],
			"outcome.": ["mejoro", "igual", "empeoro"],
			"import.error.": ["not-a-pack", "unsupported-schema", "empty"],
			"import.status.": ["new", "duplicate", "skipped", "unsupported"],
			"issue.": ["unknown-type", "missing-required", "invalid-closed-value", "few-shot-examples-range", "cot-min-criteria", "sensitive-requires-no-invent"],
		};
		const missing: string[] = [];
		for (const [prefix, ids] of Object.entries(groups)) {
			for (const id of ids) if (!hasKey(`${prefix}${id}`)) missing.push(`${prefix}${id}`);
		}
		expect(missing).toEqual([]);
	});
});
