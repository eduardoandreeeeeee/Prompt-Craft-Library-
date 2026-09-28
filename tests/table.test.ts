import { describe, expect, it } from "vitest";
import type { SearchItem } from "../src/core/search";
import { nextSort, sortItems } from "../src/core/table";

const make = (over: Partial<SearchItem>): SearchItem => ({
	path: "x.md", title: "T", dominio: "", tareaQueResuelve: "", notaReutilizacion: "", tecnica: [], tarea: [],
	herramienta: [], sector: [], sensibilidad: "general", estado: "borrador", prompt: "", version: 1, iteraciones: 0, sinMejora: 0, modificado: 0, ...over,
});

const items = [
	make({ title: "Beta", dominio: "Zeta", version: 3, modificado: 100 }),
	make({ title: "Alfa", dominio: "", version: 1, modificado: 300 }),
	make({ title: "Gamma", dominio: "áncora", version: 3, modificado: 200 }),
];

describe("orden de la tabla", () => {
	it("ordena texto sin distinguir tildes y deja lo vacío al final", () => {
		expect(sortItems(items, { key: "dominio", dir: "asc" }).map((i) => i.title)).toEqual(["Gamma", "Beta", "Alfa"]);
		expect(sortItems(items, { key: "dominio", dir: "desc" }).map((i) => i.title)).toEqual(["Beta", "Gamma", "Alfa"]);
	});

	it("ordena números y desempata por título", () => {
		expect(sortItems(items, { key: "version", dir: "desc" }).map((i) => i.title)).toEqual(["Beta", "Gamma", "Alfa"]);
		expect(sortItems(items, { key: "modificado", dir: "desc" }).map((i) => i.title)).toEqual(["Alfa", "Gamma", "Beta"]);
	});

	it("no modifica la lista original", () => {
		const copy = [...items];
		sortItems(items, { key: "title", dir: "desc" });
		expect(items).toEqual(copy);
	});

	it("al hacer clic invierte la misma columna o cambia de columna", () => {
		expect(nextSort({ key: "title", dir: "asc" }, "title")).toEqual({ key: "title", dir: "desc" });
		expect(nextSort({ key: "title", dir: "asc" }, "estado")).toEqual({ key: "estado", dir: "asc" });
		expect(nextSort({ key: "title", dir: "asc" }, "modificado")).toEqual({ key: "modificado", dir: "desc" });
	});
});
