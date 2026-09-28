import YAML from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import { blockId, parseNote } from "../src/core/pack";
import { parseExamples, validateExamples } from "../src/core/examples";
import { countExamples, linkTarget, stripFrontmatter } from "../src/core/library";
import { folderForNote, planInstall } from "../src/core/install";
import { buildPaths } from "../src/core/paths";
import { BLOQUE_NO_INVENTAR, extractPromptSection, toList, validatePrompt } from "../src/core/schema";
import { extractVariables } from "../src/core/variables";
import { setLocale } from "../src/i18n";
import { starterNotes, starterSpec } from "../src/starter";
import { sanitizeFolderName } from "../src/core/paths";

afterEach(() => setLocale("es"));

const stringify = (v: unknown) => YAML.stringify(v);
const parse = (s: string) => YAML.parse(s);
const paths = buildPaths("", { prompts: "", system: "", metaPrompts: "", blocks: "", examples: "", logs: "", reference: "", packs: "" }, {
	root: "Biblioteca", prompts: "Prompts", system: "Sistema", metaPrompts: "Meta", blocks: "Bloques", examples: "Ejemplos", logs: "Bitácoras", reference: "Referencia", packs: "Paquetes",
});

for (const locale of ["es", "en"] as const) {
	describe(`paquete inicial (${locale})`, () => {
		const build = () => {
			setLocale(locale);
			return starterNotes(stringify, locale);
		};

		it("cada nota de prompt y meta-prompt cumple el mínimo del método", () => {
			const notes = build();
			const banks = new Map(notes.filter((n) => n.tipo === "ejemplos").map((n) => [sanitizeFolderName(n.titulo), n]));
			const checked = notes.filter((n) => n.tipo === "prompt" || n.tipo === "meta-prompt");
			expect(checked.length).toBeGreaterThanOrEqual(12);
			for (const n of checked) {
				const target = linkTarget(n.frontmatter.ejemplos_ref);
				const bank = target ? banks.get(target) : undefined;
				if (target) expect(bank, `banco de ${n.titulo}`).toBeTruthy();
				const issues = validatePrompt(n.frontmatter, n.body, { ejemplosCount: bank ? countExamples(bank.body) : undefined });
				expect(issues, n.titulo).toEqual([]);
			}
		});

		it("los prompts few-shot tienen banco y los de chain of thought, criterios", () => {
			const notes = build().filter((n) => n.tipo === "prompt");
			expect(notes.some((n) => toList(n.frontmatter.tecnica).includes("few-shot"))).toBe(true);
			expect(notes.some((n) => toList(n.frontmatter.tecnica).includes("chain-of-thought"))).toBe(true);
			expect(notes.some((n) => n.frontmatter.sensibilidad === "contexto-sensible")).toBe(true);
		});

		it("los bancos de ejemplos son válidos y se pueden leer", () => {
			for (const n of build().filter((x) => x.tipo === "ejemplos")) {
				const ex = parseExamples(n.body);
				expect(validateExamples(ex), n.titulo).toEqual([]);
			}
		});

		it("todo bloque usado existe en el paquete o es el incorporado", () => {
			const notes = build();
			const ids = new Set(notes.filter((n) => n.tipo === "bloque").map((n) => blockId(n.frontmatter, n.titulo)));
			expect(ids.has(BLOQUE_NO_INVENTAR)).toBe(true);
			for (const n of notes) {
				for (const id of toList(n.frontmatter.bloques)) expect(ids.has(id), `${n.titulo}: ${id}`).toBe(true);
			}
		});

		it("las notas sobreviven a escribirse y leerse, y sus variables se reconocen", () => {
			for (const n of build()) {
				const again = parseNote(n.raw, parse);
				expect(again.tipo).toBe(n.tipo);
				expect(again.titulo).toBe(n.titulo);
				if (n.tipo === "prompt" || n.tipo === "meta-prompt") {
					const text = extractPromptSection(stripFrontmatter(n.raw));
					expect(text.length).toBeGreaterThan(50);
					const names = extractVariables(text).map((v) => v.name);
					// Una variable con espacios o llaves sueltas indica un error de escritura.
					for (const name of names) expect(name, n.titulo).toMatch(/^[\p{L}\p{N}_-]+$/u);
				}
			}
		});

		it("los títulos no repiten nombre de archivo dentro de una misma carpeta", () => {
			const notes = build();
			const plan = planInstall(notes, (n) => folderForNote(n, paths), () => false, "skip");
			const all = plan.map((p) => p.path);
			expect(new Set(all).size).toBe(all.length);
			expect(plan.every((p) => p.status === "new")).toBe(true);
		});

		it("se reparten en las carpetas que corresponden", () => {
			const plan = planInstall(build(), (n) => folderForNote(n, paths), () => false, "skip");
			const folders = new Set(plan.map((p) => p.folder));
			expect(folders.has(paths.blocks)).toBe(true);
			expect(folders.has(paths.examples)).toBe(true);
			expect(folders.has(paths.metaPrompts)).toBe(true);
			expect(folders.has(paths.domain(starterSpec(locale).domains.analisis))).toBe(true);
		});
	});
}

describe("paridad entre idiomas", () => {
	it("español e inglés tienen los mismos identificadores y estructura", () => {
		const es = starterSpec("es");
		const en = starterSpec("en");
		expect(en.blocks.map((b) => b.id)).toEqual(es.blocks.map((b) => b.id));
		expect(en.banks.map((b) => [b.key, b.ejemplos.length])).toEqual(es.banks.map((b) => [b.key, b.ejemplos.length]));
		const shape = (p: (typeof es.prompts)[number]) => [p.dominio, p.tarea, p.tecnica, p.sensibilidad, p.bloques, p.ejemplos, p.criterios?.length];
		expect(en.prompts.map(shape)).toEqual(es.prompts.map(shape));
		expect(en.metas.map(shape)).toEqual(es.metas.map(shape));
	});

	it("el texto del inglés no repite el del español", () => {
		const es = starterSpec("es");
		const en = starterSpec("en");
		expect(en.prompts.every((p, i) => p.prompt !== es.prompts[i].prompt)).toBe(true);
	});
});
