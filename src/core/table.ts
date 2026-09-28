/**
 * Vista de tabla de la biblioteca: columnas y orden. No depende de Obsidian.
 */

import { SearchItem, normalizeText } from "./search";

export const TABLE_COLUMNS = [
	"title",
	"dominio",
	"tecnica",
	"herramienta",
	"estado",
	"sensibilidad",
	"version",
	"iteraciones",
	"modificado",
] as const;
export type TableColumn = (typeof TABLE_COLUMNS)[number];
export type SortDir = "asc" | "desc";

export interface SortState {
	key: TableColumn;
	dir: SortDir;
}

/** Columnas cuyo valor se ordena como número. */
const NUMERIC: readonly TableColumn[] = ["version", "iteraciones", "modificado"];

export function isNumericColumn(column: TableColumn): boolean {
	return NUMERIC.includes(column);
}

/** Valor comparable de una columna; las listas se unen con coma. */
export function sortValue(item: SearchItem, column: TableColumn): string | number {
	switch (column) {
		case "version":
		case "iteraciones":
		case "modificado":
			return item[column];
		case "tecnica":
		case "herramienta":
			return normalizeText(item[column].join(", "));
		default:
			return normalizeText(item[column]);
	}
}

/** Copia ordenada. Los valores vacíos van al final; los empates se resuelven por título. */
export function sortItems(items: SearchItem[], state: SortState): SearchItem[] {
	const sign = state.dir === "asc" ? 1 : -1;
	return [...items].sort((a, b) => {
		const va = sortValue(a, state.key);
		const vb = sortValue(b, state.key);
		const emptyA = va === "";
		const emptyB = vb === "";
		if (emptyA !== emptyB) return emptyA ? 1 : -1;
		let cmp = 0;
		if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
		else if (typeof va === "string" && typeof vb === "string") cmp = va.localeCompare(vb);
		return cmp !== 0 ? cmp * sign : a.title.localeCompare(b.title);
	});
}

/** Orden después de hacer clic en una columna: la misma invierte, otra empieza ascendente (fecha y contadores, descendente). */
export function nextSort(current: SortState, clicked: TableColumn): SortState {
	if (current.key === clicked) return { key: clicked, dir: current.dir === "asc" ? "desc" : "asc" };
	return { key: clicked, dir: isNumericColumn(clicked) ? "desc" : "asc" };
}
