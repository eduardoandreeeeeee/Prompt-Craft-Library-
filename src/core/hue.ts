/**
 * Asigna a un texto (por ejemplo, un dominio) un número estable entre 0 y buckets - 1,
 * para pintarlo siempre del mismo color de la paleta del tema.
 */
export function hueIndex(text: string, buckets: number): number {
	let hash = 0;
	for (const char of text.trim().toLowerCase()) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}
	return hash % buckets;
}
