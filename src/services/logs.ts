import { App, TFile } from "obsidian";
import { baseName, linkTarget, stripFrontmatter } from "../core/library";
import { IterationInput, appendToLog, currentPrompt, initialLogBody, iterationEntry, nextCounters, replacePromptSection } from "../core/iteration";
import { cleanPromptText } from "../core/builder";
import { noteFileName, uniquePath } from "../core/note";
import type { LibraryPaths } from "../core/paths";
import { ESQUEMA_ACTUAL } from "../core/schema";
import { t } from "../i18n";
import { ensureFolder } from "./folders";
import { filesIn } from "./library";

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/** Bitácora de un prompt: la nota de la carpeta de bitácoras cuyo campo «prompt» enlaza a él. */
export function findLogFile(app: App, paths: LibraryPaths, promptFile: TFile): TFile | null {
	for (const file of filesIn(app, paths.logs)) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (fm?.tipo !== "bitacora") continue;
		const target = linkTarget(fm.prompt);
		if (!target) continue;
		if (app.metadataCache.getFirstLinkpathDest(target, file.path) === promptFile) return file;
	}
	return null;
}

export interface IterationContext {
	/** Prompt vigente antes de iterar. */
	prompt: string;
	version: number;
	iteraciones: number;
	sinMejora: number;
	estado: string;
}

/** Estado actual del ciclo de refinamiento de una nota. */
export async function readIterationContext(app: App, file: TFile): Promise<IterationContext> {
	const fm = (app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
	const body = stripFrontmatter(await app.vault.cachedRead(file));
	const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
	return {
		prompt: cleanPromptText(currentPrompt(body)),
		version: num(fm.version, 1),
		iteraciones: num(fm.iteraciones, 0),
		sinMejora: num(fm.iteraciones_sin_mejora, 0),
		estado: typeof fm.estado === "string" ? fm.estado : "borrador",
	};
}

export interface IterationResult {
	sinMejora: number;
	logPath: string;
}

/**
 * Registra una iteración: agrega la entrada a la bitácora (la crea con el prompt inicial si
 * no existe), actualiza el prompt vigente y los contadores de la nota.
 */
export async function recordIteration(
	app: App,
	paths: LibraryPaths,
	file: TFile,
	input: IterationInput,
): Promise<IterationResult> {
	const before = await app.vault.read(file);
	const fm = (app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
	const oldPrompt = currentPrompt(stripFrontmatter(before));
	const newPrompt = input.newPrompt.trim();
	const promptChanged = newPrompt !== "" && cleanPromptText(newPrompt) !== cleanPromptText(oldPrompt);
	const counters = nextCounters(fm, input.outcome, promptChanged);

	let log = findLogFile(app, paths, file);
	if (!log) {
		await ensureFolder(app, paths.logs);
		const name = baseName(file.path);
		const path = uniquePath(paths.logs, noteFileName(`${name} ${t("log.fileSuffix")}`), (p) => app.vault.getAbstractFileByPath(p) !== null);
		log = await app.vault.create(path, initialLogBody(oldPrompt));
		await app.fileManager.processFrontMatter(log, (target: Record<string, unknown>) => {
			target.esquema = ESQUEMA_ACTUAL;
			target.tipo = "bitacora";
			target.prompt = `[[${name}]]`;
		});
	}
	const entry = iterationEntry(input, counters.iteraciones, counters.version, promptChanged);
	await app.vault.process(log, (data) => appendToLog(data, entry));

	if (promptChanged) {
		await app.vault.process(file, (data) => {
			const head = FRONTMATTER.exec(data)?.[0] ?? "";
			return head + replacePromptSection(data.slice(head.length), newPrompt);
		});
	}
	await app.fileManager.processFrontMatter(file, (target: Record<string, unknown>) => {
		target.version = counters.version;
		target.iteraciones = counters.iteraciones;
		target.iteraciones_sin_mejora = counters.sinMejora;
		target.estado = input.estado;
	});
	return { sinMejora: counters.sinMejora, logPath: log.path };
}
