/**
 * Búsqueda y filtros sobre las notas de la biblioteca. No depende de Obsidian.
 */

import type { LibraryEntry } from "./library";
import { extractPromptSection, toList } from "./schema";

export const FILTER_FIELDS = ["dominio", "tecnica", "tarea", "herramienta", "sector", "sensibilidad", "estado"] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];

export interface SearchItem {
	path: string;
	title: string;
	dominio: string;
	tareaQueResuelve: string;
	notaReutilizacion: string;
	tecnica: string[];
	tarea: string[];
	herramienta: string[];
	sector: string[];
	sensibilidad: string;
	estado: string;
	prompt: string;
	version: number;
	iteraciones: number;
	/** Iteraciones seguidas sin mejora. */
	sinMejora: number;
	/** Fecha de modificación (ms desde 1970); 0 si no se conoce. */
	modificado: number;
}

export interface SearchFilters {
	query: string;
	/** Valor elegido por campo; vacío o ausente = sin filtro. */
	values: Partial<Record<FilterField, string>>;
}

export interface Facet {
	value: string;
	count: number;
}

export function emptyFilters(): SearchFilters {
	return { query: "", values: {} };
}

/** Minúsculas y sin tildes, para comparar sin distinguir ni mayúsculas ni acentos. */
export function normalizeText(text: string): string {
	return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const count = (value: unknown, fallback: number): number =>
	typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Convierte una nota en un elemento de búsqueda. Si el frontmatter no indica el dominio,
 * se toma de la carpeta: la primera carpeta dentro de la de prompts.
 */
export function itemFromEntry(entry: LibraryEntry, promptsPath: string, modificado = 0): SearchItem {
	const fm = entry.frontmatter;
	let dominio = str(fm.dominio);
	if (!dominio) {
		const prefix = `${promptsPath}/`;
		if (entry.path.startsWith(prefix)) {
			const parts = entry.path.slice(prefix.length).split("/");
			if (parts.length > 1) dominio = parts[0];
		}
	}
	return {
		path: entry.path,
		title: entry.title,
		dominio,
		tareaQueResuelve: str(fm.tarea_que_resuelve),
		notaReutilizacion: str(fm.nota_reutilizacion),
		tecnica: toList(fm.tecnica),
		tarea: toList(fm.tarea),
		herramienta: toList(fm.herramienta),
		sector: toList(fm.sector),
		sensibilidad: str(fm.sensibilidad),
		estado: str(fm.estado),
		prompt: extractPromptSection(entry.body),
		version: count(fm.version, 1),
		iteraciones: count(fm.iteraciones, 0),
		sinMejora: count(fm.iteraciones_sin_mejora, 0),
		modificado,
	};
}

/** Valores de un campo de la nota, siempre como lista. */
export function valuesOf(item: SearchItem, field: FilterField): string[] {
	const value = item[field];
	if (Array.isArray(value)) return value;
	return value ? [value] : [];
}

function score(item: SearchItem, tokens: string[]): number {
	const title = normalizeText(item.title);
	const task = normalizeText(item.tareaQueResuelve);
	const rest = normalizeText(
		[
			item.notaReutilizacion,
			item.prompt,
			item.dominio,
			...item.tecnica,
			...item.tarea,
			...item.herramienta,
			...item.sector,
		].join(" "),
	);
	let total = 0;
	for (const token of tokens) {
		const inTitle = title.includes(token);
		const inTask = task.includes(token);
		const inRest = rest.includes(token);
		if (!inTitle && !inTask && !inRest) return -1;
		total += (inTitle ? 3 : 0) + (inTask ? 2 : 0) + (inRest ? 1 : 0);
	}
	return total;
}

/**
 * Notas que cumplen todos los filtros y contienen todas las palabras de la búsqueda.
 * Con búsqueda, se ordenan por relevancia (título, luego tarea, luego el resto); sin ella, por título.
 */
export function searchItems(items: SearchItem[], filters: SearchFilters): SearchItem[] {
	const tokens = normalizeText(filters.query).split(/\s+/).filter(Boolean);

	const matching: { item: SearchItem; score: number }[] = [];
	for (const item of items) {
		const passes = FILTER_FIELDS.every((field) => {
			const wanted = filters.values[field];
			return !wanted || valuesOf(item, field).includes(wanted);
		});
		if (!passes) continue;
		const s = tokens.length ? score(item, tokens) : 0;
		if (s < 0) continue;
		matching.push({ item, score: s });
	}

	matching.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
	return matching.map((m) => m.item);
}

/** Valores presentes en la biblioteca para un campo, con su cantidad, del más al menos usado. */
export function facetOptions(items: SearchItem[], field: FilterField): Facet[] {
	const counts = new Map<string, number>();
	for (const item of items) {
		for (const value of new Set(valuesOf(item, field))) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.map(([value, count]) => ({ value, count }))
		.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function hasActiveFilters(filters: SearchFilters): boolean {
	return filters.query.trim() !== "" || FILTER_FIELDS.some((f) => !!filters.values[f]);
}
