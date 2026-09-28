import { describe, expect, it } from "vitest";
import { extractPromptSection, toList, validatePrompt } from "../src/core/schema";

const body = "## Prompt\n\n> Actúa como {{rol}}. Resume {{texto}}.\n\n## Notas\n\nOtra cosa";

const valid = {
	tipo: "prompt",
	tarea_que_resuelve: "Resumir informes",
	nota_reutilizacion: "Cambiar la audiencia",
	tecnica: ["estructurado"],
	sensibilidad: "general",
	estado: "borrador",
};

const codes = (fm: Record<string, unknown>, text = body, opts = {}) =>
	validatePrompt(fm, text, opts).map((i) => `${i.code}:${i.field}`);

describe("extractPromptSection", () => {
	it("toma el texto bajo «## Prompt» hasta el siguiente encabezado", () => {
		expect(extractPromptSection(body)).toBe("> Actúa como {{rol}}. Resume {{texto}}.");
	});

	it("devuelve vacío si no existe la sección", () => {
		expect(extractPromptSection("# Otro\n\ntexto")).toBe("");
	});

	it("acepta el encabezado sin distinguir mayúsculas", () => {
		expect(extractPromptSection("## PROMPT\nhola")).toBe("hola");
	});
});

describe("toList", () => {
	it("normaliza texto, listas y valores inválidos", () => {
		expect(toList("a")).toEqual(["a"]);
		expect(toList(["a", 1, " ", "b"])).toEqual(["a", "b"]);
		expect(toList(undefined)).toEqual([]);
	});
});

describe("validatePrompt", () => {
	it("acepta una entrada completa", () => {
		expect(codes(valid)).toEqual([]);
	});

	it("rechaza un tipo desconocido", () => {
		expect(codes({ ...valid, tipo: "otro" })).toEqual(["unknown-type:tipo"]);
	});

	it("exige los tres campos mínimos del método", () => {
		expect(codes({ tipo: "prompt" }, "sin sección")).toEqual([
			"missing-required:tarea_que_resuelve",
			"missing-required:nota_reutilizacion",
			"missing-required:prompt",
		]);
	});

	it("no exige el mínimo a notas que no son prompts", () => {
		expect(codes({ tipo: "bloque" })).toEqual([]);
	});

	it("rechaza valores fuera de los vocabularios cerrados", () => {
		expect(codes({ ...valid, tecnica: ["magia"] })).toContain("invalid-closed-value:tecnica");
		expect(codes({ ...valid, estado: "listo" })).toContain("invalid-closed-value:estado");
		expect(codes({ ...valid, sensibilidad: "alta" })).toContain("invalid-closed-value:sensibilidad");
	});

	it("acepta valores nuevos en los vocabularios abiertos", () => {
		expect(codes({ ...valid, herramienta: ["mi-asistente"], tarea: ["inventada"], sector: ["otro"] })).toEqual([]);
	});

	it("few-shot requiere entre 2 y 5 ejemplos cuando se conoce la cantidad", () => {
		const fs = { ...valid, tecnica: ["few-shot"] };
		expect(codes(fs, body, { ejemplosCount: 1 })).toContain("few-shot-examples-range:ejemplos_ref");
		expect(codes(fs, body, { ejemplosCount: 6 })).toContain("few-shot-examples-range:ejemplos_ref");
		expect(codes(fs, body, { ejemplosCount: 3 })).toEqual([]);
		expect(codes(fs, body)).toEqual([]);
	});

	it("chain of thought requiere al menos tres criterios", () => {
		const cot = { ...valid, tecnica: ["chain-of-thought"] };
		expect(codes(cot)).toContain("cot-min-criteria:criterios");
		expect(codes({ ...cot, criterios: ["precio", "plazo"] })).toContain("cot-min-criteria:criterios");
		expect(codes({ ...cot, criterios: ["precio", "plazo", "calidad"] })).toEqual([]);
	});

	it("la combinación few-shot + cot aplica ambas reglas", () => {
		const both = { ...valid, tecnica: ["few-shot+cot"] };
		const result = codes(both, body, { ejemplosCount: 1 });
		expect(result).toContain("few-shot-examples-range:ejemplos_ref");
		expect(result).toContain("cot-min-criteria:criterios");
	});

	it("un contexto sensible exige el bloque de no inventar datos", () => {
		const sensitive = { ...valid, sensibilidad: "contexto-sensible" };
		expect(codes(sensitive)).toContain("sensitive-requires-no-invent:bloques");
		expect(codes({ ...sensitive, bloques: ["no-inventar"] })).toEqual([]);
	});
});
