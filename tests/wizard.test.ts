import { describe, expect, it } from "vitest";
import { defaultSettings } from "../src/core/settings";
import {
	applyWizard,
	formatTermRules,
	parseOtherList,
	parseTermRules,
	stateFromSettings,
	styleIsFilled,
} from "../src/core/wizard";

describe("parseTermRules", () => {
	it("lee «usar | evitar» y descarta líneas incompletas", () => {
		const text = "convivencia educativa | convivencia escolar\nsolo un lado\n | vacío\nusar |\n  don | señor  ";
		expect(parseTermRules(text)).toEqual([
			{ usar: "convivencia educativa", evitar: "convivencia escolar" },
			{ usar: "don", evitar: "señor" },
		]);
	});

	it("formatea y vuelve a leer sin cambios", () => {
		const rules = [{ usar: "a", evitar: "b" }];
		expect(parseTermRules(formatTermRules(rules))).toEqual(rules);
	});
});

describe("parseOtherList", () => {
	it("limpia, elimina repetidos y omite lo que ya está presente", () => {
		expect(parseOtherList("Mi asistente\n\nmi  asistente\nchat\nGemini", ["chat"])).toEqual(["Mi asistente", "Gemini"]);
	});
});

describe("stateFromSettings", () => {
	it("separa las herramientas iniciales de las propias", () => {
		const s = defaultSettings();
		s.vocab.herramienta = ["chat", "n8n", "Gemini"];
		const state = stateFromSettings(s);
		expect(state.herramientas).toEqual(["chat", "n8n"]);
		expect(state.herramientasOtras).toBe("Gemini");
	});

	it("muestra los sectores tal como están y traduce los identificadores antiguos", () => {
		const s = defaultSettings();
		s.vocab.sector = ["salud", "Astronomía"];
		expect(stateFromSettings(s).sectoresText).toBe("Salud\nAstronomía");
	});

	it("no propone sectores por defecto", () => {
		expect(stateFromSettings(defaultSettings()).sectoresText).toBe("");
	});
});

describe("applyWizard", () => {
	it("no modifica los ajustes de origen y marca la configuración como completa", () => {
		const base = defaultSettings();
		const state = stateFromSettings(base);
		state.domainsText = "Informes\nInformes\nRedes / sociales";
		state.language = "en";
		state.rootFolder = " / ";
		const result = applyWizard(base, state);
		expect(result.domains).toEqual(["Informes", "Redes sociales"]);
		expect(result.language).toBe("en");
		expect(result.rootFolder).toBe("/");
		expect(result.setupCompleted).toBe(true);
		expect(result.setupPrompted).toBe(true);
		expect(base.domains).toEqual([]);
		expect(base.setupCompleted).toBe(false);
	});

	it("respeta el orden inicial de los marcados y agrega los propios al final", () => {
		const base = defaultSettings();
		const state = stateFromSettings(base);
		state.herramientas = ["n8n", "chat"];
		state.herramientasOtras = "Gemini\nchat";
		state.sectoresText = "Turismo\n\nturismo\nMinería";
		const result = applyWizard(base, state);
		expect(result.vocab.herramienta).toEqual(["chat", "n8n", "Gemini"]);
		expect(result.vocab.sector).toEqual(["Turismo", "Minería"]);
	});

	it("conserva las tareas y el resto de los ajustes", () => {
		const base = defaultSettings();
		base.vocab.tarea = ["resumir", "propia"];
		base.folderNames.prompts = "01 - Prompts";
		const result = applyWizard(base, stateFromSettings(base));
		expect(result.vocab.tarea).toEqual(["resumir", "propia"]);
		expect(result.folderNames.prompts).toBe("01 - Prompts");
	});

	it("guarda el perfil de estilo sin espacios sobrantes", () => {
		const base = defaultSettings();
		const state = stateFromSettings(base);
		state.tratamiento = "  Don y Doña ";
		state.terminosText = "niños, niñas y adolescentes | menores";
		const result = applyWizard(base, state);
		expect(result.styleProfile.tratamiento).toBe("Don y Doña");
		expect(result.styleProfile.terminos).toEqual([{ usar: "niños, niñas y adolescentes", evitar: "menores" }]);
		expect(styleIsFilled(result.styleProfile)).toBe(true);
		expect(styleIsFilled(base.styleProfile)).toBe(false);
	});
});
