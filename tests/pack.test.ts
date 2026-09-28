import YAML from "yaml";
import { describe, expect, it } from "vitest";
import {
	PACK_SCHEMA,
	ParsedNote,
	blockId,
	composeNote,
	extractFencedNotes,
	fenceFor,
	importedChanges,
	parseNote,
	parsePack,
	referencedBlocks,
	serializePack,
	withFrontmatter,
} from "../src/core/pack";
import { linkedExamples, newDomains, planInstall, summarize } from "../src/core/install";

const parse = (s: string) => YAML.parse(s);
const stringify = (v: unknown) => YAML.stringify(v);

const promptRaw = composeNote(
	{ esquema: 1, tipo: "prompt", titulo: "Resumen", dominio: "Informes", tarea_que_resuelve: "Resumir", nota_reutilizacion: "Cambia el tono", bloques: ["tono", "no-inventar"], ejemplos_ref: "[[Ejemplos de resumen]]", version: 4, iteraciones: 3, iteraciones_sin_mejora: 1 },
	"## Prompt\n\nResume {{texto}}\n\n```\ncódigo\n```\n",
	stringify,
);
const blockRaw = composeNote({ tipo: "bloque", titulo: "Tono claro" }, "# Tono claro\n\nUsa frases cortas.", stringify);

describe("notas", () => {
	it("lee frontmatter, cuerpo, tipo y título", () => {
		const n = parseNote(promptRaw, parse);
		expect(n.tipo).toBe("prompt");
		expect(n.titulo).toBe("Resumen");
		expect(n.body).toContain("## Prompt");
		expect(n.frontmatter.bloques).toEqual(["tono", "no-inventar"]);
	});

	it("toma el título del encabezado si el frontmatter no lo trae", () => {
		expect(parseNote("---\ntipo: bloque\n---\n# Mi bloque\n\ntexto", parse).titulo).toBe("Mi bloque");
	});

	it("tolera un YAML inválido o la falta de frontmatter", () => {
		expect(parseNote("---\n: : [\n---\ntexto", parse).tipo).toBe("");
		expect(parseNote("solo texto", parse).body).toBe("solo texto");
	});

	it("cambia y elimina campos del frontmatter", () => {
		const n = withFrontmatter(parseNote(promptRaw, parse), { version: 1, iteraciones: undefined, origen: "importado" }, stringify);
		expect(n.frontmatter.version).toBe(1);
		expect("iteraciones" in n.frontmatter).toBe(false);
		expect(parseNote(n.raw, parse).frontmatter.origen).toBe("importado");
		expect(n.body).toContain("Resume {{texto}}");
	});

	it("el identificador de un bloque sale del campo o del nombre", () => {
		expect(blockId({ bloque_id: "mi-id" }, "Otro")).toBe("mi-id");
		expect(blockId({}, "Tono claro")).toBe("tono-claro");
	});
});

describe("paquete", () => {
	const notes = [promptRaw, blockRaw].map((r) => parseNote(r, parse));
	const info = { nombre: "Mi paquete", descripcion: "Para informes", creado: "2026-09-28" };

	it("guarda y recupera las notas sin alterarlas", () => {
		const text = serializePack(info, notes, stringify);
		const result = parsePack(text, parse);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.info).toEqual(info);
		expect(result.notes.map((n) => n.raw.trim())).toEqual(notes.map((n) => n.raw.trim()));
		expect(result.notes[0].body).toContain("```\ncódigo\n```");
	});

	it("la valla es más larga que cualquier bloque de código de la nota", () => {
		expect(fenceFor("hola")).toBe("````");
		expect(fenceFor("a ````` b")).toBe("``````");
		const text = serializePack(info, [parseNote(composeNote({ tipo: "bloque", titulo: "X" }, "````\ndentro\n````", stringify), parse)], stringify);
		const r = parsePack(text, parse);
		expect(r.ok && r.notes[0].body).toContain("````\ndentro\n````");
	});

	it("rechaza lo que no es un paquete", () => {
		expect(parsePack("texto", parse)).toEqual({ ok: false, error: "not-a-pack" });
		expect(parsePack("---\ntipo: prompt\n---\n", parse)).toEqual({ ok: false, error: "not-a-pack" });
		expect(parsePack(`---\ntipo: paquete\nesquema_paquete: ${PACK_SCHEMA + 1}\n---\n`, parse)).toEqual({ ok: false, error: "unsupported-schema" });
		expect(parsePack("---\ntipo: paquete\n---\n", parse)).toEqual({ ok: false, error: "unsupported-schema" });
		expect(parsePack(`---\ntipo: paquete\nesquema_paquete: 1\n---\n\nsin notas`, parse)).toEqual({ ok: false, error: "empty" });
	});

	it("ignora un bloque sin cerrar", () => {
		expect(extractFencedNotes("````promptcraft-note\nabierto\n")).toEqual([]);
	});

	it("limpia las notas importadas", () => {
		const n = parseNote(promptRaw, parse);
		const changed = withFrontmatter(n, importedChanges(n), stringify);
		expect(changed.frontmatter.version).toBe(1);
		expect(changed.frontmatter.origen).toBe("importado");
		expect("iteraciones" in changed.frontmatter).toBe(false);
		expect("iteraciones_sin_mejora" in changed.frontmatter).toBe(false);
	});

	it("conserva el origen del paquete inicial y da identificador a un bloque", () => {
		const starter = parseNote(composeNote({ tipo: "prompt", origen: "paquete-inicial" }, "## Prompt\n\nx", stringify), parse);
		expect(importedChanges(starter).origen).toBeUndefined();
		const block = parseNote(blockRaw, parse);
		expect(importedChanges(block).bloque_id).toBe("tono-claro");
	});

	it("reúne los bloques y bancos que usan las notas", () => {
		const parsed = notes.map((n) => n);
		expect(referencedBlocks(parsed)).toEqual(["tono", "no-inventar"]);
		expect(linkedExamples(parsed)).toEqual(["Ejemplos de resumen"]);
	});
});

describe("plan de instalación", () => {
	const notes: ParsedNote[] = [
		parseNote(promptRaw, parse),
		parseNote(blockRaw, parse),
		parseNote(composeNote({ tipo: "bitacora", titulo: "Bitácora" }, "x", stringify), parse),
	];
	const folderFor = (n: ParsedNote) => (n.tipo === "prompt" ? "Prompts/Informes" : "Sistema/Bloques");

	it("marca nuevas, existentes y no instalables", () => {
		const plan = planInstall(notes, folderFor, (p) => p === "Sistema/Bloques/Tono claro.md", "skip");
		expect(plan.map((i) => i.status)).toEqual(["new", "exists", "unsupported"]);
		expect(plan.map((i) => i.skip)).toEqual([false, true, true]);
		expect(plan[0].path).toBe("Prompts/Informes/Resumen.md");
		expect(summarize(plan)).toEqual({ create: 1, skipped: 1, unsupported: 1 });
	});

	it("al duplicar agrega un número al nombre", () => {
		const plan = planInstall(notes, folderFor, (p) => p === "Sistema/Bloques/Tono claro.md", "duplicate");
		expect(plan[1].path).toBe("Sistema/Bloques/Tono claro 2.md");
		expect(plan[1].skip).toBe(false);
	});

	it("no repite rutas dentro de un mismo paquete", () => {
		const twin = [parseNote(blockRaw, parse), parseNote(blockRaw, parse)];
		const plan = planInstall(twin, folderFor, () => false, "duplicate");
		expect(plan.map((i) => i.path)).toEqual(["Sistema/Bloques/Tono claro.md", "Sistema/Bloques/Tono claro 2.md"]);
		expect(plan[1].status).toBe("exists");
	});

	it("detecta los dominios nuevos", () => {
		const plan = planInstall(notes, folderFor, () => false, "skip");
		expect(newDomains(plan, [])).toEqual(["Informes"]);
		expect(newDomains(plan, ["Informes"])).toEqual([]);
	});
});
