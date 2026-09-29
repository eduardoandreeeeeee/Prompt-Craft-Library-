import { describe, expect, it } from "vitest";
import {
	draftToBody,
	draftToFrontmatter,
	emptyDraft,
	noteFileName,
	suggestTareas,
	uniquePath,
	validateDraft,
	withNoInvent,
} from "../src/core/note";

const complete = () => ({
	...emptyDraft(),
	titulo: "Resumen para gerencia",
	dominio: "informes",
	tarea_que_resuelve: "Resumir informes largos",
	nota_reutilizacion: "Cambiar la audiencia",
	herramienta: ["chat"],
	prompt: "Actúa como analista. Resume {{texto}}.",
});

const codes = (d: ReturnType<typeof complete>) => validateDraft(d).map((i) => `${i.code}:${i.field}`);

describe("draftToFrontmatter", () => {
	it("omite los campos vacíos y agrega esquema, versión y origen", () => {
		const fm = draftToFrontmatter(complete());
		expect(fm).toMatchObject({ esquema: 1, tipo: "prompt", titulo: "Resumen para gerencia", version: 1, origen: "propio" });
		expect(fm).not.toHaveProperty("criterios");
		expect(fm).not.toHaveProperty("ejemplos_ref");
		expect(fm).not.toHaveProperty("sector");
	});

	it("mantiene el orden de los campos", () => {
		const keys = Object.keys(draftToFrontmatter(complete()));
		expect(keys.slice(0, 3)).toEqual(["esquema", "tipo", "titulo"]);
		expect(keys.indexOf("tarea_que_resuelve")).toBeLessThan(keys.indexOf("tecnica"));
	});
});

describe("draftToBody", () => {
	it("coloca el prompt bajo «## Prompt»", () => {
		expect(draftToBody(complete())).toBe("## Prompt\n\nActúa como analista. Resume {{texto}}.\n");
	});
});

describe("validateDraft", () => {
	it("acepta un borrador completo", () => {
		expect(codes(complete())).toEqual([]);
	});

	it("un borrador vacío reporta título y los tres campos mínimos", () => {
		expect(validateDraft(emptyDraft()).map((i) => i.field)).toEqual([
			"titulo",
			"tarea_que_resuelve",
			"nota_reutilizacion",
			"prompt",
		]);
	});

	it("few-shot exige el enlace a los ejemplos", () => {
		expect(codes({ ...complete(), tecnica: ["few-shot"] })).toEqual(["few-shot-examples-range:ejemplos_ref"]);
		expect(codes({ ...complete(), tecnica: ["few-shot"], ejemplos_ref: "[[Ejemplos]]" })).toEqual([]);
	});

	it("chain of thought exige tres criterios", () => {
		expect(codes({ ...complete(), tecnica: ["chain-of-thought"], criterios: ["a", "b"] })).toEqual(["cot-min-criteria:criterios"]);
	});

	it("contexto sensible exige el bloque de no inventar", () => {
		const sensitive = { ...complete(), sensibilidad: "contexto-sensible" as const };
		expect(codes(sensitive)).toEqual(["sensitive-requires-no-invent:bloques"]);
		expect(codes({ ...sensitive, bloques: withNoInvent([], true) })).toEqual([]);
	});
});

describe("withNoInvent", () => {
	it("agrega sin duplicar y quita sin tocar otros bloques", () => {
		expect(withNoInvent(["otro"], true)).toEqual(["otro", "no-inventar"]);
		expect(withNoInvent(["no-inventar"], true)).toEqual(["no-inventar"]);
		expect(withNoInvent(["otro", "no-inventar"], false)).toEqual(["otro"]);
	});
});

describe("noteFileName y uniquePath", () => {
	it("limpia caracteres no permitidos y usa un nombre por defecto", () => {
		expect(noteFileName("Ficha: ¿qué / cómo?")).toBe("Ficha ¿qué cómo.md");
		expect(noteFileName("  ")).toBe("Sin título.md");
	});

	it("agrega un número si la ruta ya existe", () => {
		const taken = new Set(["P/Nota.md", "P/Nota 2.md"]);
		expect(uniquePath("P", "Nota.md", (p) => taken.has(p))).toBe("P/Nota 3.md");
		expect(uniquePath("P", "Otra.md", (p) => taken.has(p))).toBe("P/Otra.md");
		expect(uniquePath("", "Otra.md", () => false)).toBe("Otra.md");
	});
});

describe("suggestTareas", () => {
	const options = ["redactar", "resumir", "traducir-idioma", "extraer-datos", "analizar-datos", "Responder reclamos"];

	it("reconoce el verbo aunque esté conjugado o con tilde", () => {
		expect(suggestTareas("Redacta un correo para el cliente", options)).toEqual(["redactar"]);
		expect(suggestTareas("Resúmeme el informe", options)).toEqual(["resumir"]);
	});

	it("ordena por posición en el texto y no se deja llevar por palabras secundarias", () => {
		expect(suggestTareas("Extrae los montos y luego resume", options)).toEqual(["extraer-datos", "resumir"]);
		expect(suggestTareas("Revisa estos datos", options)).toEqual([]);
	});

	it("usa también la etiqueta y los valores propios de la persona", () => {
		const label = (id: string) => (id === "traducir-idioma" ? "Translate" : id);
		expect(suggestTareas("Translate this email", options, label)).toEqual(["traducir-idioma"]);
		expect(suggestTareas("Responde los reclamos del día", options)).toEqual(["Responder reclamos"]);
	});

	it("con texto vacío no sugiere nada y devuelve como máximo tres", () => {
		expect(suggestTareas("  ", options)).toEqual([]);
		expect(suggestTareas("redactar resumir traducir extraer analizar", options)).toHaveLength(3);
	});
});
