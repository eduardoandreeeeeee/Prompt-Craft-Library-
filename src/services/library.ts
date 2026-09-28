import { App, TFile } from "obsidian";
import {
	NoteResult,
	NoteSource,
	countExamples,
	entryFromNote,
	linkTarget,
	stripFrontmatter,
	validateNote,
} from "../core/library";
import { BlockNote, blockText, resolveBlocks } from "../core/blocks";
import { blockId } from "../core/pack";
import { Example, formatExamplesForPrompt, parseExamples } from "../core/examples";
import { PromptDraft, draftToBody, draftToFrontmatter, noteFileName, uniquePath } from "../core/note";
import { toList } from "../core/schema";
import { baseName } from "../core/library";
import type { LibraryPaths } from "../core/paths";
import { SearchItem, itemFromEntry } from "../core/search";
import { ensureFolder } from "./folders";
import type { LibraryEntry } from "../core/library";

/** Lee una nota: frontmatter desde la caché de Obsidian y cuerpo desde el archivo. */
export async function readNoteSource(app: App, file: TFile): Promise<NoteSource> {
	const content = await app.vault.cachedRead(file);
	const cache = app.metadataCache.getFileCache(file);
	const fm = cache?.frontmatter ? { ...(cache.frontmatter as Record<string, unknown>) } : null;
	return { path: file.path, frontmatter: fm, body: stripFrontmatter(content) };
}

/** Cantidad de ejemplos de la nota enlazada en «ejemplos_ref»; undefined si no hay enlace o no se encuentra. */
export async function resolveExamplesCount(
	app: App,
	from: TFile,
	fm: Record<string, unknown> | null,
): Promise<number | undefined> {
	const target = linkTarget(fm?.ejemplos_ref);
	if (!target) return undefined;
	const linked = app.metadataCache.getFirstLinkpathDest(target, from.path);
	if (!linked) return undefined;
	return countExamples(stripFrontmatter(await app.vault.cachedRead(linked)));
}

export async function validateFile(app: App, file: TFile): Promise<NoteResult> {
	const src = await readNoteSource(app, file);
	const count = await resolveExamplesCount(app, file, src.frontmatter);
	return validateNote(src, count);
}

/** Notas Markdown dentro de la carpeta de prompts, incluidas las de los dominios. */
export function listLibraryFiles(app: App, paths: LibraryPaths): TFile[] {
	const prefix = `${paths.prompts}/`;
	return app.vault
		.getMarkdownFiles()
		.filter((f) => f.path.startsWith(prefix))
		.sort((a, b) => a.path.localeCompare(b.path));
}

export async function validateLibrary(app: App, paths: LibraryPaths): Promise<NoteResult[]> {
	const results: NoteResult[] = [];
	// Los meta-prompts cumplen el mismo mínimo que los prompts.
	const files = [...listLibraryFiles(app, paths), ...filesIn(app, paths.metaPrompts)];
	for (const file of files) {
		results.push(await validateFile(app, file));
	}
	return results;
}

/** Crea la nota de un borrador ya validado en la carpeta de su dominio. */
export async function createPromptNote(app: App, paths: LibraryPaths, draft: PromptDraft): Promise<TFile> {
	const folder =
		draft.tipo === "meta-prompt" ? paths.metaPrompts : draft.dominio ? paths.domain(draft.dominio) : paths.prompts;
	await ensureFolder(app, folder);
	const path = uniquePath(folder, noteFileName(draft.titulo), (p) => app.vault.getAbstractFileByPath(p) !== null);
	const file = await app.vault.create(path, draftToBody(draft));
	const fm = draftToFrontmatter(draft);
	await app.fileManager.processFrontMatter(file, (target: Record<string, unknown>) => {
		for (const [key, value] of Object.entries(fm)) target[key] = value;
	});
	return file;
}

/** Prompts de la biblioteca listos para buscar. Ignora las notas que no son de tipo prompt. */
export async function loadSearchItems(app: App, paths: LibraryPaths): Promise<SearchItem[]> {
	const items: SearchItem[] = [];
	for (const file of listLibraryFiles(app, paths)) {
		const entry = entryFromNote(await readNoteSource(app, file));
		if (entry.frontmatter.tipo !== "prompt") continue;
		items.push(itemFromEntry(entry, paths.prompts, file.stat.mtime));
	}
	return items;
}

/** Notas Markdown de una carpeta (y sus subcarpetas). */
export function filesIn(app: App, folder: string): TFile[] {
	const prefix = `${folder}/`;
	return app.vault
		.getMarkdownFiles()
		.filter((f) => f.path.startsWith(prefix))
		.sort((a, b) => a.path.localeCompare(b.path));
}

/** Notas de un tipo dentro de una carpeta, con su frontmatter ya leído. */
export async function loadNotesOfType(app: App, folder: string, tipo: string): Promise<LibraryEntry[]> {
	const found: LibraryEntry[] = [];
	for (const file of filesIn(app, folder)) {
		const entry = entryFromNote(await readNoteSource(app, file));
		if (entry.frontmatter.tipo === tipo) found.push(entry);
	}
	return found;
}

/** Bloques reutilizables de la biblioteca. */
export async function loadBlocks(app: App, paths: LibraryPaths): Promise<BlockNote[]> {
	const entries = await loadNotesOfType(app, paths.blocks, "bloque");
	return entries.map((e) => ({
		id: blockId(e.frontmatter, baseName(e.path)),
		title: e.title,
		text: blockText(e.body),
	}));
}

export interface ExampleBank {
	path: string;
	title: string;
	/** Nombre del archivo sin extensión: lo que se escribe en el enlace. */
	link: string;
	count: number;
}

/** Bancos de ejemplos de la biblioteca. */
export async function loadExampleBanks(app: App, paths: LibraryPaths): Promise<ExampleBank[]> {
	const entries = await loadNotesOfType(app, paths.examples, "ejemplos");
	return entries.map((e) => ({
		path: e.path,
		title: e.title,
		link: baseName(e.path),
		count: parseExamples(e.body).length,
	}));
}

/** Meta-prompts de la biblioteca. */
export function loadMetaPrompts(app: App, paths: LibraryPaths): Promise<LibraryEntry[]> {
	return loadNotesOfType(app, paths.metaPrompts, "meta-prompt");
}

export interface PromptExtrasData {
	/** Ejemplos ya formateados para el prompt; vacío si no hay banco enlazado. */
	examplesText: string;
	/** Cantidad de ejemplos del banco enlazado; undefined si no hay enlace o no se encontró. */
	examplesCount: number | undefined;
	blockTexts: string[];
	/** Bloques que la nota pide y no existen. */
	missingBlocks: string[];
	blockIds: string[];
}

/** Ejemplos y bloques que acompañan a un prompt: resuelve «ejemplos_ref» y «bloques». */
export async function loadPromptExtras(
	app: App,
	paths: LibraryPaths,
	file: TFile,
	fm: Record<string, unknown>,
): Promise<PromptExtrasData> {
	let examples: Example[] = [];
	let examplesCount: number | undefined;
	const target = linkTarget(fm.ejemplos_ref);
	if (target) {
		const linked = app.metadataCache.getFirstLinkpathDest(target, file.path);
		if (linked) {
			examples = parseExamples(stripFrontmatter(await app.vault.cachedRead(linked)));
			examplesCount = examples.length;
		}
	}
	const blockIds = toList(fm.bloques);
	const resolved = resolveBlocks(blockIds, blockIds.length ? await loadBlocks(app, paths) : []);
	return {
		examplesText: formatExamplesForPrompt(examples),
		examplesCount,
		blockTexts: resolved.texts,
		missingBlocks: resolved.missing,
		blockIds,
	};
}

/** Crea una nota con su texto completo en la carpeta indicada. Devuelve el archivo creado. */
export async function createNoteFile(app: App, path: string, raw: string): Promise<TFile> {
	const slash = path.lastIndexOf("/");
	if (slash > 0) await ensureFolder(app, path.slice(0, slash));
	return app.vault.create(path, raw);
}

/** Crea una nota de un tipo cualquiera a partir de su frontmatter y su cuerpo. */
export async function createNoteWith(
	app: App,
	folder: string,
	fileName: string,
	fm: Record<string, unknown>,
	body: string,
): Promise<TFile> {
	await ensureFolder(app, folder);
	const path = uniquePath(folder, fileName, (p) => app.vault.getAbstractFileByPath(p) !== null);
	const file = await app.vault.create(path, body);
	await app.fileManager.processFrontMatter(file, (target: Record<string, unknown>) => {
		for (const [key, value] of Object.entries(fm)) target[key] = value;
	});
	return file;
}
