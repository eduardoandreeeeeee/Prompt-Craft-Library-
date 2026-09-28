import { afterEach, describe, expect, it } from "vitest";
import { BlockNote, blockText, builtinBlockText, resolveBlocks, slugify } from "../src/core/blocks";
import {
	Example,
	buildExamplesBody,
	formatExamplesForPrompt,
	parseExamples,
	validateExamples,
} from "../src/core/examples";
import { countExamples } from "../src/core/library";
import { setLocale } from "../src/i18n";

afterEach(() => setLocale("es"));

const three: Example[] = [
	{ input: "a", output: "1" },
	{ input: "b\nsegunda línea", output: "2" },
	{ input: "c", output: "3" },
];

describe("banco de ejemplos", () => {
	it("escribe y vuelve a leer los ejemplos", () => {
		const body = buildExamplesBody(three);
		expect(countExamples(body)).toBe(3);
		expect(parseExamples(body)).toEqual(three);
	});

	it("lee las etiquetas en inglés y en español", () => {
		setLocale("en");
		const body = buildExamplesBody(three);
		expect(body).toContain("### Example 1");
		setLocale("es");
		expect(parseExamples(body)).toEqual(three);
	});

	it("ignora el texto fuera de los ejemplos", () => {
		const body = `Introducción\n\n## Otra cosa\n\ntexto\n\n${buildExamplesBody(three)}\n## Fin\n\nmás texto\n`;
		expect(parseExamples(body)).toEqual(three);
	});

	it("da formato a los ejemplos para agregarlos al prompt", () => {
		const text = formatExamplesForPrompt(three.slice(0, 2));
		expect(text).toContain("Sigue el formato de estos ejemplos:");
		expect(text).toContain("Ejemplo 2\nEntrada: b\nsegunda línea\nSalida: 2");
		expect(formatExamplesForPrompt([])).toBe("");
	});

	it("exige entre 2 y 5 ejemplos completos", () => {
		expect(validateExamples(three)).toEqual([]);
		expect(validateExamples(three.slice(0, 1))).toContain("count");
		expect(validateExamples([...three, ...three])).toContain("count");
		expect(validateExamples([three[0], { input: "x", output: "" }])).toContain("empty");
	});
});

describe("bloques", () => {
	it("crea identificadores estables", () => {
		expect(slugify("Pedir aclaración")).toBe("pedir-aclaracion");
		expect(slugify("  Tono  claro!! ")).toBe("tono-claro");
	});

	it("quita el título de nivel 1 del texto del bloque", () => {
		expect(blockText("# Título\n\nHaz esto.\n")).toBe("Haz esto.");
		expect(blockText("Sin título\n")).toBe("Sin título");
	});

	it("usa un texto de respaldo para no-inventar", () => {
		expect(builtinBlockText("no-inventar")).toContain("No inventes");
		expect(builtinBlockText("otro")).toBeNull();
	});

	it("resuelve los bloques y avisa de los que faltan", () => {
		const available: BlockNote[] = [{ id: "tono", title: "Tono", text: "Usa un tono claro." }];
		const r = resolveBlocks(["tono", "no-inventar", "fantasma"], available);
		expect(r.texts).toEqual(["Usa un tono claro.", expect.stringContaining("No inventes")]);
		expect(r.missing).toEqual(["fantasma"]);
	});

	it("una nota propia tiene prioridad sobre el texto de respaldo", () => {
		const r = resolveBlocks(["no-inventar"], [{ id: "no-inventar", title: "x", text: "Mi versión" }]);
		expect(r.texts).toEqual(["Mi versión"]);
	});
});
