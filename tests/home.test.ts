import { describe, expect, it } from "vitest";
import { homeAlerts, homeSteps, libraryStats, recentItems } from "../src/core/home";
import type { SearchItem } from "../src/core/search";

const make = (over: Partial<SearchItem>): SearchItem => ({
	path: "x.md", title: "T", dominio: "", tareaQueResuelve: "", notaReutilizacion: "", tecnica: [], tarea: [],
	herramienta: [], sector: [], sensibilidad: "general", estado: "borrador", prompt: "", version: 1, iteraciones: 0, sinMejora: 0, modificado: 0, ...over,
});
const DAY = 24 * 60 * 60 * 1000;

describe("pasos para empezar", () => {
	it("marca lo que ya está hecho", () => {
		const steps = homeSteps({ setupCompleted: true, foldersMissing: true, blockCount: 0, promptCount: 0 });
		expect(steps.map((s) => s.done)).toEqual([true, false, false, false]);
	});

	it("con prompts, el paquete inicial y el primer prompt cuentan como hechos", () => {
		const steps = homeSteps({ setupCompleted: true, foldersMissing: false, blockCount: 0, promptCount: 2 });
		expect(steps.every((s) => s.done)).toBe(true);
	});
});

describe("resumen de la biblioteca", () => {
	const items = [
		make({ title: "A", dominio: "Informes", estado: "validado", iteraciones: 2 }),
		make({ title: "B", dominio: "Informes", estado: "borrador", iteraciones: 1 }),
		make({ title: "C", dominio: "Atención", estado: "borrador" }),
		make({ title: "D", dominio: "" }),
	];

	it("cuenta por estado, incluidos los que están en cero", () => {
		const s = libraryStats(items);
		expect(s.total).toBe(4);
		expect(s.byEstado.find((e) => e.estado === "borrador")?.count).toBe(3);
		expect(s.byEstado.find((e) => e.estado === "archivado")?.count).toBe(0);
		expect(s.iterations).toBe(3);
	});

	it("cuenta por dominio, del mayor al menor, sin las notas sin dominio", () => {
		expect(libraryStats(items).byDominio).toEqual([
			{ dominio: "Informes", count: 2 },
			{ dominio: "Atención", count: 1 },
		]);
	});
});

describe("avisos", () => {
	const now = 100 * DAY;

	it("no devuelve avisos si todo está en orden", () => {
		expect(homeAlerts([make({ modificado: now })], [{ path: "x.md", name: "T", issues: [] }], now)).toEqual([]);
	});

	it("detecta notas con problemas, estancadas y borradores antiguos", () => {
		const items = [
			make({ title: "Estancada", path: "a.md", sinMejora: 3, modificado: now }),
			make({ title: "Vieja", path: "b.md", estado: "borrador", modificado: now - 40 * DAY }),
			make({ title: "Reciente", path: "c.md", estado: "borrador", modificado: now - 5 * DAY }),
			make({ title: "Vieja validada", path: "d.md", estado: "validado", modificado: now - 90 * DAY }),
		];
		const results = [{ path: "a.md", name: "Estancada", issues: [{ code: "missing-required" as const, field: "prompt" }] }];
		const alerts = homeAlerts(items, results, now);
		expect(alerts.map((a) => [a.kind, a.count])).toEqual([["invalid", 1], ["stalled", 1], ["oldDraft", 1]]);
		expect(alerts[2].notes[0].title).toBe("Vieja");
	});

	it("muestra como máximo cinco notas por aviso pero cuenta todas", () => {
		const items = Array.from({ length: 8 }, (_, i) => make({ title: `N${i}`, sinMejora: 4 }));
		const [alert] = homeAlerts(items, [], now);
		expect(alert.count).toBe(8);
		expect(alert.notes).toHaveLength(5);
	});
});

describe("recientes", () => {
	it("ordena por modificación y respeta el límite", () => {
		const items = [make({ title: "A", modificado: 1 }), make({ title: "B", modificado: 3 }), make({ title: "C", modificado: 2 })];
		expect(recentItems(items, 2).map((i) => i.title)).toEqual(["B", "C"]);
	});
});
