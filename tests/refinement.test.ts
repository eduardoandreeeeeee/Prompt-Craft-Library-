import { afterEach, describe, expect, it } from "vitest";
import {
	DIAGNOSTIC_IDS,
	DIAGNOSTIC_TARGET,
	STOP_AFTER,
	adjustLabel,
	fixText,
	shouldSuggestReference,
	symptomText,
	targetsFor,
} from "../src/core/diagnostics";
import {
	appendToLog,
	canSaveIteration,
	initialLogBody,
	iterationEntry,
	nextCounters,
	quoteLines,
	replacePromptSection,
} from "../src/core/iteration";
import { hasKey, setLocale } from "../src/i18n";
import { cleanPromptText } from "../src/core/builder";

afterEach(() => setLocale("es"));

describe("diagnóstico", () => {
	it("todo síntoma tiene texto, corrección y elemento a ajustar", () => {
		for (const id of DIAGNOSTIC_IDS) {
			expect(hasKey(`diag.${id}.symptom`), id).toBe(true);
			expect(hasKey(`diag.${id}.fix`), id).toBe(true);
			expect(DIAGNOSTIC_TARGET[id]).toBeTruthy();
			expect(symptomText(id).length).toBeGreaterThan(5);
			expect(fixText(id).length).toBeGreaterThan(5);
		}
	});

	it("propone los elementos a ajustar sin repetirlos", () => {
		expect(targetsFor(["D05", "D06", "D02", "X99"])).toEqual(["restricciones", "formato"]);
		expect(targetsFor([])).toEqual([]);
	});

	it("nombra lo que se ajusta en el idioma activo", () => {
		expect(adjustLabel("rol")).toBe("Rol");
		expect(adjustLabel("fuera-del-prompt")).toContain("fuera del prompt");
		setLocale("en");
		expect(adjustLabel("rol")).toBe("Role");
	});

	it("sugiere un documento de referencia tras tres iteraciones sin mejora", () => {
		expect(shouldSuggestReference(STOP_AFTER - 1)).toBe(false);
		expect(shouldSuggestReference(STOP_AFTER)).toBe(true);
	});
});

describe("contadores de iteración", () => {
	it("suma versión e iteración y reinicia la racha si mejoró", () => {
		expect(nextCounters({}, "mejoro")).toEqual({ version: 2, iteraciones: 1, sinMejora: 0 });
		expect(nextCounters({ version: 2, iteraciones: 1, iteraciones_sin_mejora: 2 }, "mejoro").sinMejora).toBe(0);
	});

	it("cuenta las iteraciones seguidas sin mejora", () => {
		const c = nextCounters({ version: 3, iteraciones: 2, iteraciones_sin_mejora: 1 }, "igual");
		expect(c).toEqual({ version: 4, iteraciones: 3, sinMejora: 2 });
		expect(nextCounters({ iteraciones_sin_mejora: 2 }, "empeoro").sinMejora).toBe(3);
	});

	it("la versión no sube si el prompt no cambió", () => {
		expect(nextCounters({ version: 2 }, "igual", false)).toEqual({ version: 2, iteraciones: 1, sinMejora: 1 });
	});

	it("tolera valores inválidos", () => {
		expect(nextCounters({ version: "x", iteraciones: -4 }, "igual")).toEqual({ version: 2, iteraciones: 1, sinMejora: 1 });
	});
});

describe("replacePromptSection", () => {
	const body = "## Prompt\n\nViejo texto\n\n## Notas\n\nAlgo\n";

	it("cambia solo la sección del prompt", () => {
		const out = replacePromptSection(body, "Nuevo\ntexto");
		expect(out).toContain("## Prompt\n\nNuevo\ntexto\n");
		expect(out).toContain("## Notas\n\nAlgo");
		expect(out).not.toContain("Viejo");
	});

	it("crea la sección si no existe", () => {
		expect(replacePromptSection("Solo texto\n", "Nuevo")).toContain("## Prompt\n\nNuevo");
	});

	it("funciona cuando el prompt es la última sección", () => {
		expect(replacePromptSection("## Prompt\n\nA\n", "B")).toBe("## Prompt\n\nB\n");
	});
});

describe("bitácora", () => {
	it("cita cada línea, también las vacías", () => {
		expect(quoteLines("a\n\nb")).toBe("> a\n>\n> b");
	});

	it("el prompt guardado en la bitácora se puede recuperar limpio", () => {
		const log = initialLogBody("Línea 1\n\nLínea 2");
		expect(log).toContain("> [!note]- Prompt, versión 1");
		const quoted = log.split("\n").filter((l) => l.startsWith(">") && !l.startsWith("> [!")).join("\n");
		expect(cleanPromptText(quoted)).toBe("Línea 1\n\nLínea 2");
	});

	it("registra síntomas, elemento, resultado y el prompt resultante", () => {
		const entry = iterationEntry(
			{ symptoms: ["D05"], target: "restricciones", note: "Agregué no inventar", outcome: "mejoro", newPrompt: "P2", estado: "en-iteracion", date: "2026-09-28" },
			1,
			2,
			true,
		);
		expect(entry).toContain("## Iteración 1 · 2026-09-28");
		expect(entry).toContain("D05 · Inventa datos");
		expect(entry).toContain("Elemento ajustado: Restricciones");
		expect(entry).toContain("Resultado: Mejoró");
		expect(entry).toContain("> [!note]- Prompt, versión 2\n> P2");
	});

	it("indica cuando el prompt no cambió", () => {
		const entry = iterationEntry(
			{ symptoms: [], target: "formato", note: "", outcome: "igual", newPrompt: "", estado: "borrador", date: "2026-01-01" },
			2,
			2,
			false,
		);
		expect(entry).toContain("no cambió");
		expect(entry).not.toContain("[!note]");
	});

	it("en el registro rápido, sin síntomas ni nota, registra elemento, resultado y prompt", () => {
		const entry = iterationEntry(
			{ target: "tarea", outcome: "mejoro", newPrompt: "P3", estado: "en-iteracion", date: "2026-09-28" },
			3,
			3,
			true,
		);
		expect(entry).not.toContain("Síntomas");
		expect(entry).not.toContain("Nota");
		expect(entry).toContain("Elemento ajustado: Tarea");
		expect(entry).toContain("> P3");
	});

	it("el diagnóstico completo exige un síntoma o una nota; el registro rápido no", () => {
		expect(canSaveIteration("completo", { symptoms: [], note: "  " })).toBe(false);
		expect(canSaveIteration("completo", { symptoms: ["D01"] })).toBe(true);
		expect(canSaveIteration("completo", { note: "cambié el tono" })).toBe(true);
		expect(canSaveIteration("rapido", {})).toBe(true);
	});

	it("agrega la entrada al final", () => {
		expect(appendToLog("## A\n\nx\n", "## B\n")).toBe("## A\n\nx\n\n## B\n");
	});
});
