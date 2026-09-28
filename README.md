# Prompt Craft Library

Plugin de Obsidian para construir, ordenar y mejorar una biblioteca personal de prompts con un método claro: cinco elementos (rol, contexto, tarea, formato y restricciones), técnicas (estructurado, few-shot, chain of thought) y refinamiento iterativo.

Todo se hace a mano y dentro de tu bóveda: el plugin **no se conecta a ninguna IA**. Prepara el texto, tú lo copias y lo pegas donde quieras. Sus notas son Markdown con frontmatter, así que son tuyas y se pueden leer sin el plugin.

La interfaz está en español e inglés (Ajustes → Prompt Craft Library → Idioma).

## Qué incluye

- **Notas de prompt con validación.** Cada entrada exige lo mínimo: el prompt, para qué tarea sirve y una nota de reutilización. Few-shot pide entre 2 y 5 ejemplos, chain of thought pide al menos 3 criterios y un contexto sensible exige el bloque «no inventar datos».
- **Formulario con modo paso a paso.** Completas los cinco elementos por separado; el plugin arma el prompt y avisa cuál falta.
- **Variables.** `{{nombre}}`, `{{nombre|valor por defecto}}` o `{{nombre|valor por defecto|ayuda}}`. Para escribir llaves literales (por ejemplo en n8n) usa `\{{Mensaje}}`.
- **Constructor.** Completa las variables, suma los ejemplos y bloques del prompt, agrega tu perfil de estilo si quieres y copia el resultado. Avisa según la sensibilidad del prompt.
- **Bloques reutilizables y bancos de ejemplos.** Fragmentos de texto y ejemplos de entrada y salida que se agregan a varios prompts.
- **Ciclo de refinamiento.** Registras qué viste en la respuesta (diagnóstico D01–D14), qué elemento ajustaste y cómo quedó. El historial va a una bitácora por prompt. Con tres iteraciones seguidas sin mejora, el plugin sugiere adjuntar un documento de referencia.
- **Meta-prompts y «Mejorar este prompt».** Elige un meta-prompt y el plugin prepara el texto con tu prompt dentro, listo para pegar.
- **Pantalla de inicio interactiva.** Se abre al iniciar la bóveda (se puede desactivar). Pasos para empezar, últimos prompts, resumen que abre la tabla filtrada, bloques y paquetes, avisos de qué revisar y ayuda breve. Hay botones para volver al inicio desde las notas, el panel y la tabla.
- **Búsqueda, panel lateral y tabla.** Filtra por dominio, técnica, herramienta, sensibilidad y estado; ordena la biblioteca completa por columna.
- **Paquetes.** Exporta notas a un archivo para compartirlas e importa el de otra persona sin sobrescribir nada.
- **Paquete inicial.** Bloques, ejemplos, prompts y meta-prompts de partida, en español o inglés.

## Instalación

Copia `main.js`, `manifest.json` y `styles.css` a:

```
<tu bóveda>/.obsidian/plugins/prompt-craft-library/
```

y actívalo en Ajustes → Complementos de la comunidad. Requiere Obsidian 1.7.2 o superior.

Al abrirlo por primera vez se inicia un asistente de cinco pasos (idioma, dominios, herramientas y sectores, perfil de estilo y resumen). Al terminar crea las carpetas y, si lo dejas marcado, instala el paquete inicial.

## Uso rápido

Todo está en el botón de la biblioteca de la barra lateral, en la paleta de comandos (`Ctrl/Cmd + P`) y en la barra de estado. Cada comando puede tener su propio atajo en Ajustes → Atajos de teclado.

| Quiero… | Comando |
|---|---|
| Ver por dónde empezar | Abrir la pantalla de inicio |
| Crear un prompt | Nueva nota de prompt |
| Buscar o usar un prompt | Buscar en la biblioteca / Usar un prompt |
| Ver todo en una tabla | Abrir la tabla de la biblioteca |
| Anotar qué pasó al probarlo | Registrar una iteración del prompt |
| Pedir una versión mejor | Mejorar este prompt (con un meta-prompt) |
| Crear bloques o ejemplos | Nuevo bloque reutilizable / Nuevo banco de ejemplos |
| Compartir o recibir prompts | Exportar / Importar un paquete de prompts |

Un flujo típico: crear el prompt, usarlo en el constructor y copiarlo, probarlo en tu IA y registrar la iteración con lo que viste. Repite cambiando un solo elemento por vez.

## Paquetes

Un paquete es un archivo Markdown con las notas dentro. Para compartirlo basta enviar ese archivo. Quien lo recibe lo copia a su carpeta de paquetes (o a cualquier lugar de su bóveda) y usa «Importar un paquete de prompts». Las bitácoras no viajan en el paquete.

El paquete inicial trae contenido propio del plugin. El contenido de cursos o materiales de terceros no se incluye.

## Desarrollo

```
npm install
npm run dev        # compila en modo observación
npm test           # pruebas
npm run typecheck
npm run build      # genera main.js
```

TypeScript, esbuild y vitest. La lógica está en `src/core` sin depender de Obsidian; los servicios y pantallas (`src/services`, `src/ui`) son delgados. Más detalle en `docs/ARQUITECTURA.md`.

## Publicación

Sube el número de versión con `npm version`, crea la etiqueta y súbela (`git push --tags`): GitHub Actions ejecuta las pruebas, compila y crea un borrador de release con los tres archivos.

---

# English summary

Prompt Craft Library is an Obsidian plugin to build and refine a personal prompt library around a five-element method (role, context, task, format, constraints), few-shot and chain of thought techniques, and iterative refinement. Nothing is connected to any AI: the plugin prepares text and you paste it manually.

It includes validated prompt notes, a step-by-step form, variables (`{{name|default|hint}}`, escape with `\{{literal}}`), a builder that adds examples, reusable blocks and your style profile, a refinement log with a diagnostic checklist (D01–D14) and a stop rule, meta-prompts with "Improve this prompt", search, a side panel, a sortable table, pack export/import and a starter pack. The interface is available in Spanish and English.

Install by copying `main.js`, `manifest.json` and `styles.css` to `<vault>/.obsidian/plugins/prompt-craft-library/` (Obsidian 1.7.2+).
