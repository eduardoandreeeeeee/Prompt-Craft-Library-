import { App, TFile, parseYaml, stringifyYaml } from "obsidian";
import { baseName, linkTarget } from "../core/library";
import { PlanItem, folderForNote } from "../core/install";
import { noteFileName, uniquePath } from "../core/note";
import { PackInfo, PackResult, ParsedNote, blockId, importedChanges, parseNote, parsePack, referencedBlocks, serializePack, withFrontmatter } from "../core/pack";
import type { LibraryPaths } from "../core/paths";
import { ensureFolder } from "./folders";
import { filesIn } from "./library";

export { folderForNote };

/** Notas que se pueden incluir en un paquete: prompts, meta-prompts, bloques y bancos de ejemplos. */
export function exportableFiles(app: App, paths: LibraryPaths): TFile[] {
	const folders = [paths.prompts, paths.metaPrompts, paths.blocks, paths.examples];
	const out: TFile[] = [];
	for (const folder of folders) {
		for (const file of filesIn(app, folder)) {
			const tipo: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.tipo;
			if (tipo === "prompt" || tipo === "meta-prompt" || tipo === "bloque" || tipo === "ejemplos") out.push(file);
		}
	}
	return out;
}

/**
 * Notas de las que dependen las elegidas y que no están en la selección: los bloques que
 * usan y los bancos de ejemplos que enlazan.
 */
export async function dependenciesOf(app: App, paths: LibraryPaths, selected: TFile[]): Promise<TFile[]> {
	const chosen = new Set(selected.map((f) => f.path));
	const extra: TFile[] = [];
	const notes = await Promise.all(selected.map(async (f) => parseNote(await app.vault.cachedRead(f), parseYaml)));

	const wantedBlocks = new Set(referencedBlocks(notes));
	if (wantedBlocks.size) {
		for (const file of filesIn(app, paths.blocks)) {
			const fm = app.metadataCache.getFileCache(file)?.frontmatter;
			if (fm?.tipo !== "bloque" || chosen.has(file.path)) continue;
			if (wantedBlocks.has(blockId(fm, baseName(file.path)))) {
				extra.push(file);
				chosen.add(file.path);
			}
		}
	}
	notes.forEach((note, i) => {
		const target = linkTarget(note.frontmatter.ejemplos_ref);
		if (!target) return;
		const linked = app.metadataCache.getFirstLinkpathDest(target, selected[i].path);
		if (linked && !chosen.has(linked.path)) {
			extra.push(linked);
			chosen.add(linked.path);
		}
	});
	return extra;
}

/** Escribe un paquete con las notas indicadas en la carpeta de paquetes. Devuelve el archivo. */
export async function exportPack(app: App, paths: LibraryPaths, files: TFile[], info: PackInfo): Promise<TFile> {
	const notes: ParsedNote[] = [];
	for (const file of files) {
		let note = parseNote(await app.vault.read(file), parseYaml);
		// Un bloque necesita un identificador estable para que las notas lo encuentren al importarlo.
		if (note.tipo === "bloque" && !note.frontmatter.bloque_id) {
			note = withFrontmatter(note, { bloque_id: blockId(note.frontmatter, baseName(file.path)) }, stringifyYaml);
		}
		if (!note.titulo) note = withFrontmatter(note, { titulo: baseName(file.path) }, stringifyYaml);
		notes.push(note);
	}
	await ensureFolder(app, paths.packs);
	const path = uniquePath(paths.packs, noteFileName(info.nombre), (p) => app.vault.getAbstractFileByPath(p) !== null);
	return app.vault.create(path, serializePack(info, notes, stringifyYaml));
}

/** Archivos de la bóveda que son paquetes (por su frontmatter), los de la carpeta de paquetes primero. */
export function packFiles(app: App, paths: LibraryPaths): TFile[] {
	const prefix = `${paths.packs}/`;
	return app.vault
		.getMarkdownFiles()
		.filter((f) => app.metadataCache.getFileCache(f)?.frontmatter?.tipo === "paquete")
		.sort((a, b) => Number(b.path.startsWith(prefix)) - Number(a.path.startsWith(prefix)) || a.path.localeCompare(b.path));
}

export async function readPack(app: App, file: TFile): Promise<PackResult> {
	return parsePack(await app.vault.read(file), parseYaml);
}

/** Escribe las notas del plan que no se omiten. Devuelve cuántas creó. */
export async function installPlan(app: App, items: PlanItem[]): Promise<number> {
	let created = 0;
	for (const item of items) {
		if (item.skip) continue;
		const note = withFrontmatter(item.note, importedChanges(item.note), stringifyYaml);
		await ensureFolder(app, item.folder);
		await app.vault.create(item.path, note.raw);
		created++;
	}
	return created;
}
