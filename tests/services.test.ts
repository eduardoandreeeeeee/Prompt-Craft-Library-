import YAML from "yaml";
import { beforeEach, describe, expect, it } from "vitest";

import { buildPaths } from "../src/core/paths";
import { folderForNote, planInstall } from "../src/core/install";
import { parseNote } from "../src/core/pack";
import { setLocale } from "../src/i18n";
import { installPlan } from "../src/services/packs";
import { dependenciesOf, exportPack, exportableFiles, packFiles, readPack } from "../src/services/packs";
import { findLogFile, readIterationContext, recordIteration } from "../src/services/logs";
import { createPromptNote, loadBlocks, loadExampleBanks, loadPromptExtras, loadSearchItems } from "../src/services/library";
import { emptyDraft } from "../src/core/note";
import { starterNotes } from "../src/starter";
import { stripFrontmatter } from "../src/core/library";

// --- Bóveda simulada -------------------------------------------------------------------
class FakeFile {
	path: string;
	basename: string;
	extension = "md";
	stat = { mtime: 1_700_000_000_000 };
	constructor(path: string) {
		this.path = path;
		this.basename = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");
	}
}

const FM = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

type AnyApp = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function makeApp() {
	const contents = new Map<string, string>();
	const files = new Map<string, FakeFile>();
	const folders = new Set<string>();

	const frontmatterOf = (file: FakeFile): Record<string, unknown> | undefined => {
		const m = FM.exec(contents.get(file.path) ?? "");
		return m ? (YAML.parse(m[1]) as Record<string, unknown>) : undefined;
	};

	const app = {
		vault: {
			getAbstractFileByPath: (p: string) => files.get(p) ?? (folders.has(p) ? { path: p } : null),
			createFolder: async (p: string) => void folders.add(p),
			create: async (p: string, data: string) => {
				if (files.has(p)) throw new Error("exists " + p);
				const f = new FakeFile(p);
				files.set(p, f);
				contents.set(p, data);
				return f;
			},
			read: async (f: FakeFile) => contents.get(f.path) ?? "",
			cachedRead: async (f: FakeFile) => contents.get(f.path) ?? "",
			process: async (f: FakeFile, fn: (d: string) => string) => void contents.set(f.path, fn(contents.get(f.path) ?? "")),
			getMarkdownFiles: () => [...files.values()],
		},
		fileManager: {
			processFrontMatter: async (f: FakeFile, fn: (fm: Record<string, unknown>) => void) => {
				const data = contents.get(f.path) ?? "";
				const m = FM.exec(data);
				const fm = m ? (YAML.parse(m[1]) as Record<string, unknown>) : {};
				fn(fm);
				const body = m ? data.slice(m[0].length) : data;
				contents.set(f.path, `---\n${YAML.stringify(fm).trimEnd()}\n---\n${body}`);
			},
		},
		metadataCache: {
			getFileCache: (f: FakeFile) => ({ frontmatter: frontmatterOf(f) }),
			getFirstLinkpathDest: (link: string) => [...files.values()].find((f) => f.basename === link) ?? null,
		},
	};
	return { app: app as AnyApp, contents, files };
}

const paths = buildPaths("/", { prompts: "", system: "", metaPrompts: "", blocks: "", examples: "", logs: "", reference: "", packs: "" }, {
	root: "Biblioteca", prompts: "Prompts", system: "Sistema", metaPrompts: "Meta", blocks: "Bloques", examples: "Ejemplos", logs: "Bitácoras", reference: "Referencia", packs: "Paquetes",
});
const stringify = (v: unknown) => YAML.stringify(v);

beforeEach(() => setLocale("es"));

async function install(app: AnyApp) {
	const plan = planInstall(starterNotes(stringify), (n) => folderForNote(n, paths), (p) => app.vault.getAbstractFileByPath(p) !== null, "skip");
	return { plan, created: await installPlan(app, plan) };
}

describe("instalación del paquete inicial", () => {
	it("crea todas las notas en sus carpetas y no repite al instalarlo otra vez", async () => {
		const { app, files } = makeApp();
		const first = await install(app);
		expect(first.created).toBe(starterNotes(stringify).length);
		const second = await install(app);
		expect(second.created).toBe(0);
		expect([...files.keys()].some((p) => p.startsWith("Sistema/Bloques/"))).toBe(true);
		expect([...files.keys()].some((p) => p.startsWith("Prompts/Análisis/"))).toBe(true);
	});

	it("los bloques, bancos y prompts instalados se leen desde la bóveda", async () => {
		const { app } = makeApp();
		await install(app);
		expect((await loadBlocks(app, paths)).map((b) => b.id)).toEqual(expect.arrayContaining(["no-inventar", "tono-claro"]));
		const banks = await loadExampleBanks(app, paths);
		expect(banks.map((b) => b.count)).toEqual([3, 2]);
		const items = await loadSearchItems(app, paths);
		expect(items.length).toBe(10);
		expect(items.every((i) => i.version === 1 && i.modificado > 0)).toBe(true);
	});

	it("un prompt few-shot recibe sus ejemplos y sus bloques", async () => {
		const { app, files } = makeApp();
		await install(app);
		const file = files.get("Prompts/Análisis/Extraer datos de un correo.md")!;
		const fm = app.metadataCache.getFileCache(file).frontmatter;
		const extras = await loadPromptExtras(app, paths, file as never, fm);
		expect(extras.examplesCount).toBe(2);
		expect(extras.examplesText).toContain("Marta Ruiz");
		expect(extras.blockTexts[0]).toContain("No inventes");
		expect(extras.missingBlocks).toEqual([]);
	});
});

describe("ciclo de refinamiento", () => {
	async function setup() {
		const ctx = makeApp();
		const draft = { ...emptyDraft(), titulo: "Mi prompt", dominio: "Informes", tarea_que_resuelve: "Resumir", nota_reutilizacion: "Cambia el tono", prompt: "Resume {{texto}}." };
		const file = await createPromptNote(ctx.app, paths, draft);
		return { ...ctx, file };
	}
	const input = (over = {}) => ({ symptoms: ["D05"], target: "restricciones" as const, note: "Agregué no inventar", outcome: "mejoro" as const, newPrompt: "Resume {{texto}}. No inventes datos.", estado: "en-iteracion" as const, date: "2026-09-28", ...over });

	it("crea la bitácora con el prompt inicial y actualiza la nota", async () => {
		const { app, contents, file } = await setup();
		const result = await recordIteration(app, paths, file as never, input());
		const log = findLogFile(app, paths, file as never);
		expect(log?.path).toBe("Sistema/Bitácoras/Mi prompt bitácora.md");
		const logText = contents.get(log!.path)!;
		expect(logText).toContain("tipo: bitacora");
		expect(logText).toContain("prompt: \"[[Mi prompt]]\"");
		expect(logText).toContain("> [!note]- Prompt inicial".replace("Prompt inicial", "Prompt, versión 1"));
		expect(logText).toContain("## Iteración 1 · 2026-09-28");
		expect(logText).toContain("> [!note]- Prompt, versión 2");
		const note = contents.get(file.path)!;
		const fm = parseNote(note, YAML.parse).frontmatter;
		expect(fm.version).toBe(2);
		expect(fm.iteraciones).toBe(1);
		expect(fm.iteraciones_sin_mejora).toBe(0);
		expect(fm.estado).toBe("en-iteracion");
		expect(stripFrontmatter(note)).toContain("Resume {{texto}}. No inventes datos.");
		expect(result.sinMejora).toBe(0);
	});

	it("reutiliza la bitácora y cuenta las iteraciones sin mejora", async () => {
		const { app, contents, file, files } = await setup();
		await recordIteration(app, paths, file as never, input());
		await recordIteration(app, paths, file as never, input({ outcome: "igual", newPrompt: "Resume {{texto}}. Sin inventar." }));
		const last = await recordIteration(app, paths, file as never, input({ outcome: "empeoro", newPrompt: "" }));
		expect([...files.keys()].filter((p) => p.startsWith("Sistema/Bitácoras/")).length).toBe(1);
		expect(last.sinMejora).toBe(2);
		const fm = parseNote(contents.get(file.path)!, YAML.parse).frontmatter;
		expect(fm.iteraciones).toBe(3);
		expect(fm.version).toBe(3); // la tercera iteración no cambió el prompt
		const ctx = await readIterationContext(app, file as never);
		expect(ctx.sinMejora).toBe(2);
		expect(ctx.prompt).toContain("Sin inventar");
		expect(contents.get("Sistema/Bitácoras/Mi prompt bitácora.md")).toContain("no cambió");
	});

	it("no toca el resto de la nota al cambiar el prompt", async () => {
		const { app, contents, file } = await setup();
		await app.vault.process(file, (d: string) => `${d}\n## Notas\n\nMis notas\n`);
		await recordIteration(app, paths, file as never, input());
		expect(contents.get(file.path)).toContain("## Notas\n\nMis notas");
	});
});

describe("exportar e importar", () => {
	it("un paquete exportado se puede leer e instalar en otra bóveda", async () => {
		const a = makeApp();
		await install(a.app);

		const selected = exportableFiles(a.app, paths).filter((f) => f.basename === "Extraer datos de un correo");
		expect(selected.length).toBe(1);
		const extra = await dependenciesOf(a.app, paths, selected as never);
		expect(extra.map((f) => f.basename).sort()).toEqual(["Ejemplos de extracción de datos de correos", "No inventar datos"]);

		const pack = await exportPack(a.app, paths, [...selected, ...extra] as never, { nombre: "Mi paquete", descripcion: "Prueba", creado: "2026-09-28" });
		expect(pack.path).toBe("Sistema/Paquetes/Mi paquete.md");
		expect(packFiles(a.app, paths).map((f) => f.path)).toEqual(["Sistema/Paquetes/Mi paquete.md"]);

		// Otra bóveda: se copia solo el archivo del paquete.
		const b = makeApp();
		await b.app.vault.create(pack.path, a.contents.get(pack.path)!);
		const read = await readPack(b.app, (await b.app.vault.getAbstractFileByPath(pack.path)) as never);
		expect(read.ok).toBe(true);
		if (!read.ok) return;
		const plan = planInstall(read.notes, (n) => folderForNote(n, paths), (p) => b.app.vault.getAbstractFileByPath(p) !== null, "skip");
		expect(await installPlan(b.app, plan)).toBe(3);

		const fm = parseNote(b.contents.get("Prompts/Análisis/Extraer datos de un correo.md")!, YAML.parse).frontmatter;
		expect(fm.origen).toBe("paquete-inicial");
		const blocks = await loadBlocks(b.app, paths);
		expect(blocks.map((x) => x.id)).toEqual(["no-inventar"]);
		const file = b.files.get("Prompts/Análisis/Extraer datos de un correo.md")!;
		const extras = await loadPromptExtras(b.app, paths, file as never, fm);
		expect(extras.examplesCount).toBe(2);
	});

	it("un bloque sin identificador lo recibe al exportarse", async () => {
		const a = makeApp();
		const f = await a.app.vault.create("Sistema/Bloques/Tono amable.md", "---\ntipo: bloque\ntitulo: Tono amable\n---\n# Tono amable\n\nSé amable.\n");
		const pack = await exportPack(a.app, paths, [f as never], { nombre: "P", descripcion: "", creado: "2026-01-01" });
		const read = await readPack(a.app, pack);
		expect(read.ok && read.notes[0].frontmatter.bloque_id).toBe("tono-amable");
	});

	it("los prompts importados pierden los contadores de iteración", async () => {
		const a = makeApp();
		const f = await a.app.vault.create("Prompts/X.md", "---\ntipo: prompt\ntitulo: X\ntarea_que_resuelve: a\nnota_reutilizacion: b\nversion: 5\niteraciones: 4\niteraciones_sin_mejora: 2\n---\n\n## Prompt\n\nHaz algo.\n");
		const pack = await exportPack(a.app, paths, [f as never], { nombre: "P", descripcion: "", creado: "2026-01-01" });
		const read = await readPack(a.app, pack);
		if (!read.ok) throw new Error("no es paquete");
		const b = makeApp();
		await installPlan(b.app, planInstall(read.notes, (n) => folderForNote(n, paths), () => false, "skip"));
		const fm = parseNote(b.contents.get("Prompts/X.md")!, YAML.parse).frontmatter;
		expect(fm).toMatchObject({ version: 1, origen: "importado" });
		expect("iteraciones" in fm).toBe(false);
	});
});
