import { describe, expect, it } from "vitest";
import { FolderDefaults, FolderNames, buildPaths, domainFromFolder, folderKind, libraryFolders, sanitizeFolderName } from "../src/core/paths";

const defaults: FolderDefaults = {
	root: "Biblioteca de prompts",
	prompts: "Prompts",
	system: "Sistema",
	metaPrompts: "Meta-prompts",
	blocks: "Bloques",
	examples: "Ejemplos",
	logs: "Bitácoras",
	reference: "Referencia",
	packs: "Paquetes",
};

const noNames: FolderNames = {
	prompts: "",
	system: "",
	metaPrompts: "",
	blocks: "",
	examples: "",
	logs: "",
	reference: "",
	packs: "",
};

describe("sanitizeFolderName", () => {
	it("quita caracteres no permitidos y espacios repetidos", () => {
		expect(sanitizeFolderName("  atención / de   público: ")).toBe("atención de público");
	});
});

describe("buildPaths", () => {
	it("usa los valores por defecto cuando los ajustes están vacíos", () => {
		const p = buildPaths("", noNames, defaults);
		expect(p.root).toBe("Biblioteca de prompts");
		expect(p.prompts).toBe("Biblioteca de prompts/Prompts");
		expect(p.metaPrompts).toBe("Biblioteca de prompts/Sistema/Meta-prompts");
		expect(p.domain("Informes")).toBe("Biblioteca de prompts/Prompts/Informes");
	});

	it("«/» usa la raíz de la bóveda", () => {
		const p = buildPaths("/", noNames, defaults);
		expect(p.root).toBe("");
		expect(p.prompts).toBe("Prompts");
		expect(p.blocks).toBe("Sistema/Bloques");
	});

	it("respeta nombres de carpeta personalizados", () => {
		const names: FolderNames = {
			...noNames,
			prompts: "01 - Prompts",
			system: "00 - Sistema",
			metaPrompts: "002 - Meta-prompts",
		};
		const p = buildPaths("/", names, defaults);
		expect(p.prompts).toBe("01 - Prompts");
		expect(p.metaPrompts).toBe("00 - Sistema/002 - Meta-prompts");
		expect(p.domain("001 - Soporte")).toBe("01 - Prompts/001 - Soporte");
	});

	it("limpia barras sobrantes en la raíz", () => {
		expect(buildPaths("/Mi biblioteca/", noNames, defaults).root).toBe("Mi biblioteca");
	});
});

describe("libraryFolders", () => {
	it("lista las carpetas de la estructura y una por dominio", () => {
		const p = buildPaths("", noNames, defaults);
		expect(libraryFolders(p, ["Informes"])).toEqual([
			"Biblioteca de prompts/Prompts",
			"Biblioteca de prompts/Sistema/Meta-prompts",
			"Biblioteca de prompts/Sistema/Bloques",
			"Biblioteca de prompts/Sistema/Ejemplos",
			"Biblioteca de prompts/Sistema/Bitácoras",
			"Biblioteca de prompts/Sistema/Referencia",
			"Biblioteca de prompts/Sistema/Paquetes",
			"Biblioteca de prompts/Prompts/Informes",
		]);
	});
});

describe("domainFromFolder", () => {
	it("entrega el dominio según la carpeta", () => {
		expect(domainFromFolder("Prompts", "Prompts")).toBe("");
		expect(domainFromFolder("Prompts", "Prompts/Informes")).toBe("Informes");
		expect(domainFromFolder("Prompts", "Prompts/Informes/2026")).toBe("Informes");
	});

	it("devuelve null fuera de la biblioteca, incluso con nombres parecidos", () => {
		expect(domainFromFolder("Prompts", "Otra")).toBeNull();
		expect(domainFromFolder("Prompts", "Prompts extra")).toBeNull();
		expect(domainFromFolder("A/Prompts", "A")).toBeNull();
	});
});

describe("folderKind", () => {
	const p = buildPaths("", { prompts: "", system: "", metaPrompts: "", blocks: "", examples: "", logs: "", reference: "", packs: "" }, {
		root: "Lib", prompts: "Prompts", system: "Sistema", metaPrompts: "Meta", blocks: "Bloques", examples: "Ejemplos", logs: "Logs", reference: "Ref", packs: "Paquetes",
	});

	it("reconoce cada parte de la biblioteca", () => {
		expect(folderKind(p, "Lib/Prompts")).toEqual({ kind: "prompts", dominio: "" });
		expect(folderKind(p, "Lib/Prompts/Análisis/x")).toEqual({ kind: "prompts", dominio: "Análisis" });
		expect(folderKind(p, "Lib/Sistema/Bloques")).toEqual({ kind: "blocks" });
		expect(folderKind(p, "Lib/Sistema/Ejemplos/sub")).toEqual({ kind: "examples" });
		expect(folderKind(p, "Lib/Sistema/Meta")).toEqual({ kind: "metaPrompts" });
		expect(folderKind(p, "Lib/Sistema/Paquetes")).toEqual({ kind: "packs" });
	});

	it("devuelve null fuera de la biblioteca o en carpetas sin acción", () => {
		expect(folderKind(p, "Otra")).toBeNull();
		expect(folderKind(p, "Lib/Sistema/Logs")).toBeNull();
		expect(folderKind(p, "Lib/Sistema/BloquesX")).toBeNull();
	});
});
