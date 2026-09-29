import { describe, expect, it } from "vitest";
import { addOpenValue, classificationDefaultsFor, defaultSettings, mergeSettings, parseDomainList } from "../src/core/settings";
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

describe("gettingStartedCollapsed", () => {
	it("por defecto muestra «Para empezar» desplegado y respeta un valor guardado", () => {
		expect(mergeSettings(undefined).gettingStartedCollapsed).toBe(false);
		expect(mergeSettings({ gettingStartedCollapsed: true }).gettingStartedCollapsed).toBe(true);
		expect(mergeSettings({ gettingStartedCollapsed: "sí" }).gettingStartedCollapsed).toBe(false);
	});
});

describe("addOpenValue", () => {
	it("agrega un valor nuevo al final sin modificar la lista original", () => {
		const list = ["redactar"];
		const result = addOpenValue(list, "  Responder   reclamos ");
		expect(result).toEqual({ list: ["redactar", "Responder reclamos"], value: "Responder reclamos" });
		expect(list).toEqual(["redactar"]);
	});

	it("no duplica un valor existente, ni por identificador ni por etiqueta", () => {
		const label = (id: string) => (id === "adaptar-tono" ? "Adaptar tono" : id);
		expect(addOpenValue(["redactar"], "REDACTAR")).toEqual({ list: ["redactar"], value: "redactar" });
		expect(addOpenValue(["adaptar-tono"], "adaptar tono", label)).toEqual({ list: ["adaptar-tono"], value: "adaptar-tono" });
	});

	it("ignora un texto vacío", () => {
		expect(addOpenValue(["chat"], "   ")).toEqual({ list: ["chat"], value: "" });
	});
});

describe("valores por defecto de clasificación", () => {
	it("por defecto no hay ninguno", () => {
		expect(mergeSettings(undefined).defaults).toEqual({ herramienta: "", sensibilidad: "", estado: "", porDominio: {} });
	});

	it("descarta valores que no pertenecen a los vocabularios cerrados", () => {
		const d = mergeSettings({ defaults: { herramienta: " chat ", sensibilidad: "secreto", estado: "validado" } }).defaults;
		expect(d).toMatchObject({ herramienta: "chat", sensibilidad: "", estado: "validado" });
	});

	it("el dominio sobrescribe al general solo en los campos que tiene", () => {
		const d = mergeSettings({
			defaults: {
				herramienta: "chat",
				sensibilidad: "general",
				porDominio: { Salud: { sensibilidad: "datos-personales" }, Vacío: {} },
			},
		}).defaults;
		expect(Object.keys(d.porDominio)).toEqual(["Salud"]);
		expect(classificationDefaultsFor(d, "Salud")).toEqual({ herramienta: "chat", sensibilidad: "datos-personales", estado: "" });
		expect(classificationDefaultsFor(d, "Otro")).toEqual({ herramienta: "chat", sensibilidad: "general", estado: "" });
	});
});
