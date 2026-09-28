/**
 * Instalación de notas (de un paquete importado o del paquete inicial): decide dónde va cada
 * una y qué hacer si ya existe. No depende de Obsidian.
 */

import { linkTarget } from "./library";
import type { LibraryPaths } from "./paths";
import { ParsedNote } from "./pack";
import { noteFileName, uniquePath } from "./note";

export type InstallStrategy = "skip" | "duplicate";
export type InstallStatus = "new" | "exists" | "unsupported";

export const INSTALLABLE_TYPES = ["prompt", "meta-prompt", "bloque", "ejemplos"] as const;

export interface PlanItem {
	note: ParsedNote;
	/** Carpeta de destino; vacía si el tipo no se instala. */
	folder: string;
	/** Ruta final de la nota (con sufijo si se duplica). */
	path: string;
	status: InstallStatus;
	/** Si es verdadero, esta nota no se escribe. */
	skip: boolean;
}

export function isInstallable(tipo: string): boolean {
	return (INSTALLABLE_TYPES as readonly string[]).includes(tipo);
}

/** Carpeta donde va una nota según su tipo; null si el tipo no se instala. */
export function folderForNote(note: ParsedNote, paths: LibraryPaths): string | null {
	switch (note.tipo) {
		case "prompt": {
			const dominio = typeof note.frontmatter.dominio === "string" ? note.frontmatter.dominio.trim() : "";
			return dominio ? paths.domain(dominio) : paths.prompts;
		}
		case "meta-prompt":
			return paths.metaPrompts;
		case "bloque":
			return paths.blocks;
		case "ejemplos":
			return paths.examples;
		default:
			return null;
	}
}

export function planInstall(
	notes: ParsedNote[],
	folderFor: (note: ParsedNote) => string | null,
	exists: (path: string) => boolean,
	strategy: InstallStrategy,
): PlanItem[] {
	const taken = new Set<string>();
	const used = (path: string) => exists(path) || taken.has(path);

	return notes.map((note): PlanItem => {
		const folder = isInstallable(note.tipo) ? folderFor(note) : null;
		if (folder === null) return { note, folder: "", path: "", status: "unsupported", skip: true };

		const fileName = noteFileName(note.titulo || "Sin título");
		const direct = uniquePath(folder, fileName, () => false);
		const status: InstallStatus = used(direct) ? "exists" : "new";
		if (status === "exists" && strategy === "skip") return { note, folder, path: direct, status, skip: true };

		const path = status === "exists" ? uniquePath(folder, fileName, used) : direct;
		taken.add(path);
		return { note, folder, path, status, skip: false };
	});
}

/** Dominios de los prompts instalados que todavía no están en la configuración, sin repetir. */
export function newDomains(items: PlanItem[], known: string[]): string[] {
	const result: string[] = [];
	for (const item of items) {
		if (item.skip || item.note.tipo !== "prompt") continue;
		const dominio = typeof item.note.frontmatter.dominio === "string" ? item.note.frontmatter.dominio.trim() : "";
		if (dominio && !known.includes(dominio) && !result.includes(dominio)) result.push(dominio);
	}
	return result;
}

/** Bancos de ejemplos enlazados por las notas. */
export function linkedExamples(notes: ParsedNote[]): string[] {
	const found: string[] = [];
	for (const n of notes) {
		const target = linkTarget(n.frontmatter.ejemplos_ref);
		if (target && !found.includes(target)) found.push(target);
	}
	return found;
}

export interface PlanSummary {
	create: number;
	skipped: number;
	unsupported: number;
}

export function summarize(items: PlanItem[]): PlanSummary {
	return {
		create: items.filter((i) => !i.skip).length,
		skipped: items.filter((i) => i.skip && i.status !== "unsupported").length,
		unsupported: items.filter((i) => i.status === "unsupported").length,
	};
}
