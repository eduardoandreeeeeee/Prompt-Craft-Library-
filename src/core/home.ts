/**
 * Datos de la vista de inicio: pasos para empezar, resumen de la biblioteca y avisos.
 * No depende de Obsidian.
 */

import { STOP_AFTER } from "./diagnostics";
import type { NoteResult } from "./library";
import type { SearchItem } from "./search";
import { ESTADOS } from "./vocab";

export const OLD_DRAFT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type StepId = "wizard" | "folders" | "starter" | "prompt";

export interface StepInput {
	setupCompleted: boolean;
	foldersMissing: boolean;
	blockCount: number;
	promptCount: number;
}

export interface Step {
	id: StepId;
	done: boolean;
}

/** Pasos para empezar, en orden, con su estado. */
export function homeSteps(input: StepInput): Step[] {
	return [
		{ id: "wizard", done: input.setupCompleted },
		{ id: "folders", done: !input.foldersMissing },
		{ id: "starter", done: input.blockCount > 0 || input.promptCount > 0 },
		{ id: "prompt", done: input.promptCount > 0 },
	];
}

export interface LibraryStats {
	total: number;
	/** Cantidad por estado, en el orden de los estados; incluye los que están en cero. */
	byEstado: { estado: string; count: number }[];
	/** Cantidad por dominio, de mayor a menor; las notas sin dominio no se cuentan. */
	byDominio: { dominio: string; count: number }[];
	iterations: number;
}

export function libraryStats(items: SearchItem[]): LibraryStats {
	const estados = new Map<string, number>(ESTADOS.map((e) => [e, 0]));
	const dominios = new Map<string, number>();
	let iterations = 0;
	for (const item of items) {
		if (item.estado) estados.set(item.estado, (estados.get(item.estado) ?? 0) + 1);
		if (item.dominio) dominios.set(item.dominio, (dominios.get(item.dominio) ?? 0) + 1);
		iterations += item.iteraciones;
	}
	return {
		total: items.length,
		byEstado: [...estados.entries()].map(([estado, count]) => ({ estado, count })),
		byDominio: [...dominios.entries()]
			.map(([dominio, count]) => ({ dominio, count }))
			.sort((a, b) => b.count - a.count || a.dominio.localeCompare(b.dominio)),
		iterations,
	};
}

export type AlertKind = "invalid" | "stalled" | "oldDraft";

export interface HomeAlert {
	kind: AlertKind;
	count: number;
	/** Hasta cinco notas afectadas, para mostrarlas y abrirlas. */
	notes: { title: string; path: string }[];
}

const SAMPLE = 5;

/** Avisos sobre qué revisar; solo se devuelven los que tienen al menos una nota. */
export function homeAlerts(items: SearchItem[], results: NoteResult[], now: number): HomeAlert[] {
	const alerts: HomeAlert[] = [];
	const add = (kind: AlertKind, notes: { title: string; path: string }[]) => {
		if (notes.length > 0) alerts.push({ kind, count: notes.length, notes: notes.slice(0, SAMPLE) });
	};

	add(
		"invalid",
		results.filter((r) => r.issues.length > 0).map((r) => ({ title: r.name, path: r.path })),
	);
	add(
		"stalled",
		items.filter((i) => i.sinMejora >= STOP_AFTER).map((i) => ({ title: i.title, path: i.path })),
	);
	add(
		"oldDraft",
		items
			.filter((i) => i.estado === "borrador" && i.modificado > 0 && now - i.modificado > OLD_DRAFT_DAYS * DAY_MS)
			.map((i) => ({ title: i.title, path: i.path })),
	);
	return alerts;
}

/** Los prompts modificados más recientemente, del más nuevo al más antiguo. */
export function recentItems(items: SearchItem[], limit: number): SearchItem[] {
	return [...items]
		.sort((a, b) => b.modificado - a.modificado || a.title.localeCompare(b.title))
		.slice(0, limit);
}
