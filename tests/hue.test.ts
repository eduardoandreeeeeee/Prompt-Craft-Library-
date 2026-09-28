import { describe, expect, it } from "vitest";
import { hueIndex } from "../src/core/hue";

describe("hueIndex", () => {
	it("es estable y no distingue mayúsculas ni espacios de borde", () => {
		expect(hueIndex("Informes", 6)).toBe(hueIndex(" informes ", 6));
		expect(hueIndex("python", 6)).toBe(hueIndex("python", 6));
	});

	it("siempre queda dentro del rango", () => {
		for (const text of ["", "a", "atención de público", "redes sociales", "ñandú"]) {
			const i = hueIndex(text, 6);
			expect(i).toBeGreaterThanOrEqual(0);
			expect(i).toBeLessThan(6);
		}
	});

	it("reparte dominios distintos en más de un color", () => {
		const used = new Set(["python", "informes", "atención", "redes", "soporte", "docencia"].map((d) => hueIndex(d, 6)));
		expect(used.size).toBeGreaterThan(2);
	});
});
