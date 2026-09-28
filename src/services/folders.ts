import { App, normalizePath } from "obsidian";
import { LibraryPaths, libraryFolders } from "../core/paths";

/**
 * Crea una carpeta y sus ancestros que falten. Devuelve cuántas carpetas nuevas creó.
 * Se crea nivel por nivel para no depender de cómo la API trata las rutas anidadas.
 */
export async function ensureFolder(app: App, path: string): Promise<number> {
	const normalized = normalizePath(path);
	if (!normalized || normalized === "/") return 0;

	let created = 0;
	let current = "";
	for (const segment of normalized.split("/")) {
		current = current ? `${current}/${segment}` : segment;
		if (app.vault.getAbstractFileByPath(current)) continue;
		await app.vault.createFolder(current);
		created++;
	}
	return created;
}

export interface EnsureResult {
	created: number;
}

/** Crea la estructura de la biblioteca: carpetas de sistema y una carpeta por dominio. */
export async function ensureLibraryStructure(
	app: App,
	paths: LibraryPaths,
	domains: string[],
): Promise<EnsureResult> {
	let created = 0;
	for (const target of libraryFolders(paths, domains)) {
		created += await ensureFolder(app, target);
	}
	return { created };
}

/** ¿Falta alguna carpeta de la estructura? */
export function hasMissingFolders(app: App, paths: LibraryPaths, domains: string[]): boolean {
	return libraryFolders(paths, domains).some((p) => app.vault.getAbstractFileByPath(normalizePath(p)) === null);
}
