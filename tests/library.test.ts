import { afterEach, describe, expect, it } from "vitest";
import { formatIssue } from "../src/core/issues";
import { baseName, countExamples, entryFromNote, linkTarget, stripFrontmatter, validateNote } from "../src/core/library";
import { setLocale } from "../src/i18n";

afterEach(() => setLocale("es"));

describe("stripFrontmatter", () => {
	it("quita el bloque inicial", () => {
		expect(stripFrontmatter("---\ntipo: prompt\n---\n## Prompt\nhola")).toBe("## Prompt\nhola");
		expect(stripFrontmatter("---\r\ntipo: prompt\r\n---\r\ncuerpo")).toBe("cuerpo");
	});

	it("deja intacto un texto sin frontmatter o con líneas --- más abajo", () => {
		expect(stripFrontmatter("hola\n---\nchao")).toBe("hola\n---\nchao");
	});
});

describe("countExamples", () => {
	it("cuenta los encabezados de nivel 3 que empiezan con Ejemplo", () => {
		const body = "# Banco\n\n### Ejemplo 1\nx\n### Ejemplo 2\ny\n### Nota\nz\n#### Ejemplo 3";
		expect(countExamples(body)).toBe(2);
	});
});

describe("linkTarget", () => {
	it("extrae el destino de un enlace de Obsidian", () => {
		expect(linkTarget("[[Ejemplos - Caso]]")).toBe("Ejemplos - Caso");
		expect(linkTarget("[[Nota#Sección|alias]]")).toBe("Nota");
	});

	it("devuelve null si no es un enlace", () => {
		expect(linkTarget("texto")).toBeNull();
		expect(linkTarget(undefined)).toBeNull();
		expect(linkTarget("[[]]")).toBeNull();
	});
});

describe("entryFromNote y validateNote", () => {
	const body = "## Prompt\n\nResume {{texto}}";
	const fm = {
		tipo: "prompt",
		tarea_que_resuelve: "Resumir",
		nota_reutilizacion: "Cambiar audiencia",
	};

	it("usa el título del frontmatter o, si falta, el nombre del archivo", () => {
		expect(entryFromNote({ path: "P/Nota.md", frontmatter: { titulo: "Mi título" }, body }).title).toBe("Mi título");
		expect(entryFromNote({ path: "P/Nota.md", frontmatter: null, body }).title).toBe("Nota");
		expect(baseName("a/b/c.md")).toBe("c");
	});

	it("valida una nota completa sin problemas", () => {
		expect(validateNote({ path: "P/N.md", frontmatter: fm, body }).issues).toEqual([]);
	});

	it("una nota sin frontmatter tiene tipo desconocido", () => {
		const result = validateNote({ path: "P/N.md", frontmatter: null, body });
		expect(result.issues).toEqual([{ code: "unknown-type", field: "tipo" }]);
	});

	it("usa la cantidad de ejemplos cuando se conoce", () => {
		const few = { ...fm, tecnica: ["few-shot"] };
		expect(validateNote({ path: "P/N.md", frontmatter: few, body }, 1).issues).toHaveLength(1);
		expect(validateNote({ path: "P/N.md", frontmatter: few, body }, 3).issues).toEqual([]);
	});
});

describe("formatIssue", () => {
	it("usa el nombre legible del campo y el idioma activo", () => {
		expect(formatIssue({ code: "missing-required", field: "nota_reutilizacion" })).toBe(
			"Falta el campo obligatorio «Nota de reutilización».",
		);
		setLocale("en");
		expect(formatIssue({ code: "missing-required", field: "nota_reutilizacion" })).toBe(
			"The required field “Reuse note” is missing.",
		);
	});

	it("muestra el identificador si el campo no tiene traducción", () => {
		expect(formatIssue({ code: "missing-required", field: "otro_campo" })).toContain("otro_campo");
	});
});
