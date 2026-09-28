import { afterEach, describe, expect, it } from "vitest";
import { buildFinalPrompt, cleanPromptText, examplesAdvice, sensitivityAdvice } from "../src/core/builder";
import { defaultSettings } from "../src/core/settings";
import { buildStyleBlock } from "../src/core/style";
import { setLocale } from "../src/i18n";

afterEach(() => setLocale("es"));

const style = () => ({
	...defaultSettings().styleProfile,
	tratamiento: "Don y Doña",
	registro: "formal y técnico",
	terminos: [{ usar: "niños, niñas y adolescentes", evitar: "menores" }],
	cierre: "Termina con una pregunta de verificación.",
});

describe("cleanPromptText", () => {
	it("quita el formato de cita cuando todas las líneas lo tienen", () => {
		expect(cleanPromptText("> Actúa como analista.\n>\n> Resume {{texto}}.")).toBe("Actúa como analista.\n\nResume {{texto}}.");
	});

	it("quita un bloque de código que ocupa toda la sección", () => {
		expect(cleanPromptText("```\nActúa como analista.\n```")).toBe("Actúa como analista.");
		expect(cleanPromptText("```text\nHola\nchao\n```")).toBe("Hola\nchao");
	});

	it("deja intacto un texto normal o con una cita parcial", () => {
		expect(cleanPromptText("Hola\n> cita\nchao")).toBe("Hola\n> cita\nchao");
		expect(cleanPromptText("  Solo texto  ")).toBe("Solo texto");
	});
});

describe("buildStyleBlock", () => {
	it("arma el bloque con los datos ingresados", () => {
		expect(buildStyleBlock(style())).toBe(
			[
				"Preferencias de estilo:",
				"- Tratamiento: Don y Doña",
				"- Registro: formal y técnico",
				"- Usa «niños, niñas y adolescentes» en lugar de «menores».",
				"- Cierre: Termina con una pregunta de verificación.",
			].join("\n"),
		);
	});

	it("entrega texto vacío si el perfil no tiene datos y sigue el idioma activo", () => {
		expect(buildStyleBlock(defaultSettings().styleProfile)).toBe("");
		setLocale("en");
		expect(buildStyleBlock(style()).startsWith("Style preferences:")).toBe(true);
	});
});

describe("buildFinalPrompt", () => {
	it("reemplaza variables y deja la llave escapada de n8n", () => {
		const result = buildFinalPrompt("Responde a \\{{Mensaje}} para {{cliente|el cliente}}.", {}, null);
		expect(result.text).toBe("Responde a {{Mensaje}} para el cliente.");
		expect(result.missing).toEqual([]);
	});

	it("informa las variables sin valor", () => {
		expect(buildFinalPrompt("Resume {{texto}}", {}, null).missing).toEqual(["texto"]);
	});

	it("agrega el bloque de estilo al final, separado por una línea en blanco", () => {
		const result = buildFinalPrompt("Resume {{texto}}", { texto: "el informe" }, style());
		expect(result.text.startsWith("Resume el informe\n\nPreferencias de estilo:\n")).toBe(true);
	});

	it("no agrega nada si el perfil está vacío", () => {
		expect(buildFinalPrompt("Hola", {}, defaultSettings().styleProfile).text).toBe("Hola");
	});

	it("no interpreta llaves del bloque de estilo como variables", () => {
		const s = { ...style(), cierre: "Usa {{x}} tal cual" };
		expect(buildFinalPrompt("Hola", {}, s).text).toContain("{{x}}");
	});
});

describe("sensitivityAdvice", () => {
	it("general no advierte", () => {
		expect(sensitivityAdvice("general", [])).toEqual({ level: "general", requiresConfirmation: false, missingNoInvent: false });
		expect(sensitivityAdvice(undefined, undefined).level).toBe("general");
	});

	it("datos personales advierte sin exigir confirmación", () => {
		expect(sensitivityAdvice("datos-personales", [])).toEqual({ level: "personal", requiresConfirmation: false, missingNoInvent: false });
	});

	it("contexto sensible exige confirmar y avisa si falta no inventar", () => {
		expect(sensitivityAdvice("contexto-sensible", [])).toEqual({ level: "sensitive", requiresConfirmation: true, missingNoInvent: true });
		expect(sensitivityAdvice("contexto-sensible", ["no-inventar"]).missingNoInvent).toBe(false);
	});
});

describe("composición con ejemplos y bloques", () => {
	it("agrega ejemplos y bloques después del prompt, en ese orden", () => {
		const r = buildFinalPrompt("Haz {{x}}", { x: "algo" }, null, { examples: "EJ", blocks: ["B1", "B2"] });
		expect(r.text).toBe("Haz algo\n\nEJ\n\nB1\n\nB2");
	});

	it("las variables de los bloques también se reemplazan", () => {
		const r = buildFinalPrompt("Hola", { tono: "formal" }, null, { blocks: ["Usa un tono {{tono}}."] });
		expect(r.text).toBe("Hola\n\nUsa un tono formal.");
	});

	it("sin extras da el mismo resultado de antes", () => {
		expect(buildFinalPrompt("A", {}, null).text).toBe("A");
	});

	it("avisa cuando few-shot no tiene ejemplos válidos", () => {
		expect(examplesAdvice(["estructurado"], undefined)).toBe("none");
		expect(examplesAdvice(["few-shot"], undefined)).toBe("missing");
		expect(examplesAdvice(["few-shot+cot"], 1)).toBe("range");
		expect(examplesAdvice(["few-shot"], 3)).toBe("ok");
	});
});
