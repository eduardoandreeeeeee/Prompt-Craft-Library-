import { describe, expect, it } from "vitest";
import { extractVariables, renderPrompt } from "../src/core/variables";

describe("extractVariables", () => {
	it("reconoce nombre, valor por defecto y ayuda", () => {
		const vars = extractVariables("Hola {{nombre}}, cargo {{cargo|analista}} y {{etapa||etapa alcanzada}}.");
		expect(vars).toEqual([
			{ name: "nombre", defaultValue: undefined, hint: undefined },
			{ name: "cargo", defaultValue: "analista", hint: undefined },
			{ name: "etapa", defaultValue: undefined, hint: "etapa alcanzada" },
		]);
	});

	it("entrega cada variable una sola vez y conserva el orden", () => {
		const vars = extractVariables("{{b}} {{a}} {{b|x}}");
		expect(vars.map((v) => v.name)).toEqual(["b", "a"]);
		expect(vars[0].defaultValue).toBe("x");
	});

	it("ignora las llaves escapadas", () => {
		expect(extractVariables("Responde a \\{{Mensaje}} usando {{tono}}")).toHaveLength(1);
	});

	it("ignora llaves con nombre vacío", () => {
		expect(extractVariables("{{}} {{  }} {{|x}}")).toEqual([]);
	});
});

describe("renderPrompt", () => {
	it("reemplaza con el valor entregado", () => {
		expect(renderPrompt("Para {{destinatario}}", { destinatario: "gerencia" }).text).toBe("Para gerencia");
	});

	it("usa el valor por defecto cuando no hay valor", () => {
		const result = renderPrompt("Máximo {{n|150}} palabras", {});
		expect(result.text).toBe("Máximo 150 palabras");
		expect(result.missing).toEqual([]);
	});

	it("trata un valor vacío como ausente", () => {
		expect(renderPrompt("{{n|150}}", { n: "" }).text).toBe("150");
	});

	it("deja intactas y reporta las variables sin valor", () => {
		const result = renderPrompt("Resume {{texto}} para {{audiencia}}", { audiencia: "directorio" });
		expect(result.text).toBe("Resume {{texto}} para directorio");
		expect(result.missing).toEqual(["texto"]);
	});

	it("entrega literal la llave escapada, sin tratarla como variable", () => {
		const result = renderPrompt(
			"Redacta una respuesta a: «\\{{Mensaje}}». Firma: {{firma}}",
			{ firma: "equipo de atención" },
		);
		expect(result.text).toBe("Redacta una respuesta a: «{{Mensaje}}». Firma: equipo de atención");
		expect(result.missing).toEqual([]);
	});

	it("permite expresiones de n8n con espacios y puntos si van escapadas", () => {
		const result = renderPrompt("Cliente: \\{{ $json.nombre }}", {});
		expect(result.text).toBe("Cliente: {{ $json.nombre }}");
	});

	it("no reprocesa el resultado de un reemplazo", () => {
		expect(renderPrompt("{{a}}", { a: "{{b}}" }).text).toBe("{{b}}");
	});
});
