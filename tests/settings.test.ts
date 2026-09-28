import { describe, expect, it } from "vitest";
import { defaultSettings, mergeSettings, parseDomainList } from "../src/core/settings";
import { HERRAMIENTAS_INICIALES } from "../src/core/vocab";

describe("mergeSettings", () => {
	it("sin datos guardados entrega los valores por defecto", () => {
		expect(mergeSettings(undefined)).toEqual(defaultSettings());
		expect(mergeSettings(null)).toEqual(defaultSettings());
	});

	it("no comparte listas entre llamadas", () => {
		const a = mergeSettings(undefined);
		a.vocab.herramienta.push("otra");
		expect(mergeSettings(undefined).vocab.herramienta).toEqual([...HERRAMIENTAS_INICIALES]);
	});

	it("conserva lo guardado y completa lo que falta", () => {
		const merged = mergeSettings({
			rootFolder: "/",
			domains: ["informes"],
			folderNames: { prompts: "01 - Prompts" },
			styleProfile: { tratamiento: "Don y Doña" },
		});
		expect(merged.rootFolder).toBe("/");
		expect(merged.domains).toEqual(["informes"]);
		expect(merged.folderNames.prompts).toBe("01 - Prompts");
		expect(merged.folderNames.system).toBe("");
		expect(merged.styleProfile.tratamiento).toBe("Don y Doña");
		expect(merged.styleProfile.registro).toBe("");
	});

	it("descarta datos con forma inválida", () => {
		const merged = mergeSettings({
			language: "fr",
			domains: "no es lista",
			vocab: { tarea: [1, 2] },
			styleProfile: { terminos: [{ usar: "a" }, { usar: "x", evitar: "y" }] },
		});
		expect(merged.language).toBe("auto");
		expect(merged.domains).toEqual([]);
		expect(merged.vocab.tarea).toEqual([]);
		expect(merged.styleProfile.terminos).toEqual([{ usar: "x", evitar: "y" }]);
	});
});

describe("showStatusBar", () => {
	it("está activado por defecto y respeta lo guardado", () => {
		expect(mergeSettings(undefined).showStatusBar).toBe(true);
		expect(mergeSettings({ showStatusBar: false }).showStatusBar).toBe(false);
		expect(mergeSettings({ showStatusBar: "no" }).showStatusBar).toBe(true);
	});
});

describe("parseDomainList", () => {
	it("limpia, elimina vacíos y repetidos sin distinguir mayúsculas", () => {
		expect(parseDomainList("Informes\n\n  informes \nRedes / sociales\r\nAtención")).toEqual([
			"Informes",
			"Redes sociales",
			"Atención",
		]);
	});
});

describe("openHomeOnStartup", () => {
	it("por defecto abre el inicio y respeta un valor guardado", () => {
		expect(mergeSettings(undefined).openHomeOnStartup).toBe(true);
		expect(mergeSettings({ openHomeOnStartup: false }).openHomeOnStartup).toBe(false);
		expect(mergeSettings({ openHomeOnStartup: "no" }).openHomeOnStartup).toBe(true);
	});
});
