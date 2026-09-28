import { describe, expect, it } from "vitest";
import { entryFromNote } from "../src/core/library";
import {
	SearchItem,
	emptyFilters,
	facetOptions,
	hasActiveFilters,
	itemFromEntry,
	normalizeText,
	searchItems,
} from "../src/core/search";

const make = (over: Partial<SearchItem>): SearchItem => ({
	path: "P/x.md",
	title: "Sin título",
	dominio: "",
	tareaQueResuelve: "",
	notaReutilizacion: "",
	tecnica: [],
	tarea: [],
	herramienta: [],
	sector: [],
	sensibilidad: "general",
	estado: "borrador",
	prompt: "",
	version: 1,
	iteraciones: 0,
	sinMejora: 0,
	modificado: 0,
	...over,
});

const items = [
	make({ path: "P/a.md", title: "Resumen para gerencia", dominio: "informes", tareaQueResuelve: "Resumir informes largos", tecnica: ["estructurado"], herramienta: ["chat"], prompt: "Resume el texto" }),
	make({ path: "P/b.md", title: "Respuesta a reclamo", dominio: "atención", tareaQueResuelve: "Responder reclamos de clientes", tecnica: ["few-shot"], herramienta: ["chat", "n8n"], sensibilidad: "datos-personales", estado: "validado" }),
	make({ path: "P/c.md", title: "Informe de gestión", dominio: "informes", tareaQueResuelve: "Ordenar datos", tecnica: ["estructurado"], herramienta: ["copilot-word"], prompt: "Incluye un resumen final" }),
];

describe("normalizeText", () => {
	it("ignora mayúsculas y tildes", () => {
		expect(normalizeText("Atención Gestión")).toBe("atencion gestion");
	});
});

describe("searchItems", () => {
	it("sin búsqueda ni filtros entrega todo ordenado por título", () => {
		expect(searchItems(items, emptyFilters()).map((i) => i.path)).toEqual(["P/c.md", "P/b.md", "P/a.md"]);
	});

	it("exige todas las palabras y no distingue tildes", () => {
		expect(searchItems(items, { ...emptyFilters(), query: "ATENCION" }).map((i) => i.path)).toEqual(["P/b.md"]);
		expect(searchItems(items, { ...emptyFilters(), query: "zzz" })).toEqual([]);
		expect(searchItems(items, { ...emptyFilters(), query: "informe gestion" }).map((i) => i.path)).toEqual(["P/c.md"]);
	});

	it("busca también en el texto del prompt", () => {
		expect(searchItems(items, { ...emptyFilters(), query: "texto" }).map((i) => i.path)).toEqual(["P/a.md"]);
	});

	it("ordena primero las coincidencias en el título", () => {
		const result = searchItems(items, { ...emptyFilters(), query: "resumen" }).map((i) => i.path);
		expect(result).toEqual(["P/a.md", "P/c.md"]);
	});

	it("combina filtros con y", () => {
		const f = { query: "", values: { dominio: "informes", herramienta: "chat" } };
		expect(searchItems(items, f).map((i) => i.path)).toEqual(["P/a.md"]);
	});

	it("filtra por un valor dentro de una lista", () => {
		expect(searchItems(items, { query: "", values: { herramienta: "n8n" } }).map((i) => i.path)).toEqual(["P/b.md"]);
	});

	it("un filtro vacío no filtra", () => {
		expect(searchItems(items, { query: "", values: { estado: "" } })).toHaveLength(3);
	});
});

describe("facetOptions", () => {
	it("cuenta los valores presentes, del más usado al menos usado", () => {
		expect(facetOptions(items, "herramienta")).toEqual([
			{ value: "chat", count: 2 },
			{ value: "copilot-word", count: 1 },
			{ value: "n8n", count: 1 },
		]);
		expect(facetOptions(items, "estado")).toEqual([
			{ value: "borrador", count: 2 },
			{ value: "validado", count: 1 },
		]);
	});

	it("omite los campos vacíos", () => {
		expect(facetOptions(items, "sector")).toEqual([]);
	});
});

describe("itemFromEntry", () => {
	const body = "## Prompt\n\nHola {{x}}\n\n## Notas\notra cosa";

	it("toma los campos del frontmatter y el texto del prompt", () => {
		const entry = entryFromNote({
			path: "Prompts/Informes/Nota.md",
			frontmatter: { tipo: "prompt", titulo: "Mi nota", dominio: "informes", tecnica: ["few-shot"], sensibilidad: "general" },
			body,
		});
		const item = itemFromEntry(entry, "Prompts");
		expect(item).toMatchObject({ title: "Mi nota", dominio: "informes", tecnica: ["few-shot"], prompt: "Hola {{x}}" });
	});

	it("si falta el dominio lo toma de la carpeta", () => {
		const nested = itemFromEntry(entryFromNote({ path: "Prompts/Redes/N.md", frontmatter: { tipo: "prompt" }, body }), "Prompts");
		const top = itemFromEntry(entryFromNote({ path: "Prompts/N.md", frontmatter: { tipo: "prompt" }, body }), "Prompts");
		expect(nested.dominio).toBe("Redes");
		expect(top.dominio).toBe("");
	});
});

describe("hasActiveFilters", () => {
	it("detecta texto o filtros activos", () => {
		expect(hasActiveFilters(emptyFilters())).toBe(false);
		expect(hasActiveFilters({ query: " x ", values: {} })).toBe(true);
		expect(hasActiveFilters({ query: "", values: { estado: "validado" } })).toBe(true);
	});
});
