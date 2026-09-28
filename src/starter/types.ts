import type { Example } from "../core/examples";
import type { Sensibilidad, Tecnica } from "../core/vocab";

/** Contenido del paquete inicial en un idioma. Los identificadores (claves y bloques) son iguales en todos. */
export interface StarterSpec {
	domains: { redaccion: string; analisis: string; organizacion: string };
	blocks: { id: string; titulo: string; texto: string }[];
	banks: { key: string; titulo: string; tarea_que_resuelve: string; ejemplos: Example[] }[];
	prompts: StarterPrompt[];
	metas: StarterPrompt[];
}

export interface StarterPrompt {
	titulo: string;
	dominio?: "redaccion" | "analisis" | "organizacion";
	tarea: string[];
	tecnica: Tecnica[];
	sensibilidad: Sensibilidad;
	tarea_que_resuelve: string;
	nota_reutilizacion: string;
	bloques: string[];
	/** Clave del banco de ejemplos (few-shot). */
	ejemplos?: string;
	criterios?: string[];
	prompt: string;
}
