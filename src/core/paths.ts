/**
 * Rutas de la biblioteca dentro de la bóveda.
 *
 * Ningún nombre de carpeta está fijado en el código: cada uno sale de los ajustes y, si
 * está vacío, de un valor por defecto traducido que entrega quien llama.
 *
 * Carpeta raíz: vacío = valor por defecto; "/" = raíz de la bóveda.
 */

export interface FolderNames {
	prompts: string;
	system: string;
	metaPrompts: string;
	blocks: string;
	examples: string;
	logs: string;
	reference: string;
	packs: string;
}

export interface FolderDefaults extends FolderNames {
	root: string;
}

export interface LibraryPaths {
	root: string;
	prompts: string;
	system: string;
	metaPrompts: string;
	blocks: string;
	examples: string;
	logs: string;
	reference: string;
	packs: string;
	domain(name: string): string;
}

const INVALID_CHARS = /[\\/:*?"<>|]/g;

/** Nombre de carpeta seguro a partir de un texto libre (por ejemplo, un dominio). */
export function sanitizeFolderName(name: string): string {
	return name.replace(INVALID_CHARS, " ").replace(/\s+/g, " ").trim();
}

function join(...parts: string[]): string {
	return parts.filter((p) => p !== "").join("/");
}

/** Todas las carpetas que forman la estructura de la biblioteca, incluida una por dominio. */
export function libraryFolders(paths: LibraryPaths, domains: string[]): string[] {
	return [
		paths.prompts,
		paths.metaPrompts,
		paths.blocks,
		paths.examples,
		paths.logs,
		paths.reference,
		paths.packs,
		...domains.map((d) => paths.domain(d)),
	];
}

/**
 * Dominio que corresponde a una carpeta de la bóveda: vacío si es la carpeta de prompts,
 * la primera carpeta bajo ella si es una subcarpeta y null si está fuera de la biblioteca.
 */
export function domainFromFolder(promptsPath: string, folderPath: string): string | null {
	if (folderPath === promptsPath) return "";
	const prefix = `${promptsPath}/`;
	if (!folderPath.startsWith(prefix)) return null;
	return folderPath.slice(prefix.length).split("/")[0];
}

export type FolderKind =
	| { kind: "prompts"; dominio: string }
	| { kind: "blocks" | "examples" | "metaPrompts" | "packs" };

const isInside = (folder: string, base: string) => folder === base || folder.startsWith(`${base}/`);

/** Qué parte de la biblioteca es una carpeta de la bóveda; null si está fuera de ella. */
export function folderKind(paths: LibraryPaths, folderPath: string): FolderKind | null {
	const dominio = domainFromFolder(paths.prompts, folderPath);
	if (dominio !== null) return { kind: "prompts", dominio };
	for (const kind of ["blocks", "examples", "metaPrompts", "packs"] as const) {
		if (isInside(folderPath, paths[kind])) return { kind };
	}
	return null;
}

export function buildPaths(
	rootSetting: string,
	names: FolderNames,
	defaults: FolderDefaults,
): LibraryPaths {
	const pick = (value: string, fallback: string) => sanitizeFolderName(value) || fallback;

	const rootRaw = rootSetting.trim();
	const root = rootRaw === "/" ? "" : rootRaw ? rootRaw.replace(/^\/+|\/+$/g, "") : defaults.root;

	const prompts = join(root, pick(names.prompts, defaults.prompts));
	const system = join(root, pick(names.system, defaults.system));

	return {
		root,
		prompts,
		system,
		metaPrompts: join(system, pick(names.metaPrompts, defaults.metaPrompts)),
		blocks: join(system, pick(names.blocks, defaults.blocks)),
		examples: join(system, pick(names.examples, defaults.examples)),
		logs: join(system, pick(names.logs, defaults.logs)),
		reference: join(system, pick(names.reference, defaults.reference)),
		packs: join(system, pick(names.packs, defaults.packs)),
		domain: (name: string) => join(prompts, sanitizeFolderName(name)),
	};
}
