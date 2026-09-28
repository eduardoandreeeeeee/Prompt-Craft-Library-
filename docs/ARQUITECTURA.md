# Arquitectura (Prompt Craft Library 1.0)

## Lenguaje y herramientas
TypeScript con la API de Obsidian. Se empaqueta con esbuild en un único `main.js`; pruebas con vitest. No hay aplicación Python ni servidor: las notas son Markdown con frontmatter dentro de la bóveda.

## Tres capas
1. **Método fijo** (`src/core`): reglas del curso (cinco elementos, técnicas, validaciones). Igual para todas las personas.
2. **Configuración de la persona** (`data.json` vía `settings.ts`): dominios, carpetas, herramientas, sectores, perfil de estilo.
3. **Paquete inicial opcional** (`src/starter`): bloques, bancos de ejemplos, prompts y meta-prompts propios en español e inglés; se instala con el mismo mecanismo que un paquete importado y nunca es obligatorio.

## Núcleo puro vs. capa Obsidian
- `src/core` y `src/i18n` no importan `obsidian`, por lo que se prueban con vitest.
- `src/services`, `src/ui` y `src/main.ts` usan la API de Obsidian y son delgados.

## Decisiones
- **Vocabularios**: cerrados (técnica, estado, sensibilidad, tipo) y abiertos (tarea, herramienta, sector, dominio). Ids estables; etiquetas traducidas con `labelFor`.
- **i18n**: español como base; inglés completo; idioma no soportado → inglés. Un test verifica claves y marcadores.
- **Variables**: `{{nombre|defecto|ayuda}}`. Escape `\{{Mensaje}}` para n8n, que usa las mismas llaves.
- **Campo `bloques`**: lista de bloques reutilizables; `no-inventar` es obligatorio si `sensibilidad: contexto-sensible`.
- **Carpeta raíz**: vacío → carpeta por defecto; `/` → raíz de la bóveda.
- **Frontmatter abierto** con campo `esquema` para migraciones; los campos desconocidos se conservan.

## Dónde va cada funcionalidad del MVP
| Funcionalidad | Ubicación prevista |
|---|---|
| Asistente de primer uso | `src/ui/WizardModal.ts` + `core/wizard.ts` (listo) |
| Formulario de nota | `src/ui/PromptFormModal.ts` + `core/note.ts` + `core/schema.ts` (listo) |
| Lectura y validación de notas | `src/services/library.ts` + `core/library.ts` + `core/issues.ts` (listo) |
| Búsqueda | `src/ui/SearchModal.ts` + `core/search.ts` + `loadSearchItems` en `services/library.ts` (listo) |
| Constructor | `src/ui/BuilderModal.ts` + `core/builder.ts` + `core/style.ts` + `core/variables.ts` (listo) |
| Aviso de sensibilidad | `core/builder.ts` (`sensitivityAdvice`) + `BuilderModal` (listo) |
| Perfil de estilo | `core/settings.ts` + asistente; se aplica en el constructor con `core/style.ts` (listo) |

## Convenciones de las notas
- Frontmatter: se escribe con `processFrontMatter` de Obsidian; el cuerpo lleva el prompt bajo `## Prompt`.
- Un banco de ejemplos cuenta un ejemplo por cada encabezado `### Ejemplo ...`; `ejemplos_ref` enlaza esa nota (`[[Nombre]]`).
- Few-shot: el formulario exige el enlace; el comando de validar verifica que haya entre 2 y 5 ejemplos.
- La validación lee el frontmatter desde la caché de Obsidian, que puede tardar un instante en actualizarse tras editar.

## Asistente de primer uso
- Cinco pasos: idioma y carpeta raíz, dominios, herramientas y sectores, perfil de estilo, resumen.
- Se abre solo una vez (`setupPrompted`); después se abre con el comando «Abrir el asistente de configuración» o desde los ajustes.
- Todo lo que decide qué se guarda está en `core/wizard.ts` (`stateFromSettings`, `applyWizard`); la pantalla solo recoge datos.
- Herramientas y sectores: se marcan los valores iniciales y se agregan propios, uno por línea. Las tareas no se tocan en el asistente.
- Términos del perfil de estilo: una regla por línea, con el formato `usar | evitar`.

## Comandos e idioma
- Los nombres de los comandos se registran con el idioma activo; al cambiar de idioma (ajustes o asistente) se quitan y se registran de nuevo con `removeCommand` (requiere Obsidian 1.8.7 o superior).
- «Crear estructura de carpetas» solo aparece en la paleta cuando falta alguna carpeta.
- Sectores: no hay lista inicial; cada persona escribe los suyos. `SECTORES_EJEMPLO` solo alimenta las sugerencias y traduce identificadores de versiones anteriores.

## Búsqueda
- Comando «Buscar en la biblioteca»: cuadro de texto y filtros por dominio, técnica, tarea, herramienta, sector, sensibilidad y estado.
- Los filtros solo ofrecen valores que existen en la biblioteca, con su cantidad. Se combinan con «y».
- El texto se busca sin distinguir mayúsculas ni tildes, y deben aparecer todas las palabras. Se revisan título, para qué sirve, nota de reutilización, texto del prompt y etiquetas. Orden por relevancia: título, luego tarea, luego el resto.
- Solo se indexan notas con `tipo: prompt` dentro de la carpeta de prompts. El dominio se toma del frontmatter o, si falta, de la carpeta.
- Teclado: flechas para moverse, Enter para abrir. Se muestran hasta 50 resultados.

## Constructor
- Comandos «Usar un prompt» (abre la búsqueda en modo uso) y «Usar la nota actual como prompt». En la búsqueda, cada resultado tiene además un botón para la otra acción (Abrir o Usar).
- Pide un valor por cada variable `{{nombre|defecto|ayuda}}`; muestra una vista previa y avisa qué variables quedan sin valor.
- Si la sección `## Prompt` es una cita (`>`) o un bloque de código completo, se quita ese formato al copiar.
- Sensibilidad: datos personales muestra una advertencia; contexto sensible además exige confirmar antes de habilitar «Copiar» y avisa si falta el bloque `no-inventar`.
- Perfil de estilo: si tiene datos, se agrega al final como «Preferencias de estilo:», con un interruptor para incluirlo o no. El bloque se arma después de reemplazar las variables, así que sus llaves no se interpretan.

## Acceso desde la interfaz
- Botón en la barra lateral izquierda (ícono de biblioteca) que abre un menú con: buscar, usar un prompt, nueva nota, validar nota, validar biblioteca y asistente. Se vuelve a crear al cambiar de idioma para traducir el texto.
- Todos los comandos también aparecen en Ajustes → Atajos de teclado, donde cada persona les asigna su atajo. El plugin no fija atajos por defecto para no chocar con los de otros plugins.
- Panel lateral (`ui/PromptCraftView.ts`): vista fija en la barra derecha con la búsqueda y un botón de nueva nota. Se actualiza sola al cambiar, crear, borrar o renombrar notas de la biblioteca. Se abre desde el menú, el comando «Mostrar el panel de Prompt Craft» o el botón lateral.
- Clic derecho en una carpeta de la biblioteca: «Nueva nota de prompt aquí», con el dominio de esa carpeta preseleccionado. En subcarpetas usa el dominio de la carpeta de primer nivel, porque las notas se guardan en la carpeta del dominio.
- Barra de estado: acceso «Prompt Craft» que abre el mismo menú; se puede ocultar en los ajustes (solo escritorio).
- `ui/SearchPanel.ts` contiene la búsqueda y la comparten la ventana (`SearchModal`) y el panel lateral.
- Búsqueda: los filtros están plegados detrás del botón «Filtros» (con el número de filtros activos). Cada resultado muestra título, para qué sirve y una línea de datos; el botón de acción aparece al pasar el cursor o seleccionar.

## Color
- Todo el color sale de la paleta del tema activo de Obsidian (`--color-*`, `--interactive-accent`, `--text-*`) y se mezcla con `color-mix`, por lo que se adapta a cada tema, claro u oscuro. No hay colores fijos en `styles.css`.
- Significado: estado con un punto (amarillo en iteración, verde validado, naranja por revisar); sensibilidad con etiqueta naranja (datos personales) o roja (contexto sensible); dominio con etiqueta de color estable elegido por `core/hue.ts`; fila seleccionada con el color de acento.
- Constructor: la advertencia es naranja o roja según el nivel. Validación: verde si cumple, rojo si hay problemas. Asistente: barra de avance con el color de acento.

## Versión 1.0: ciclo de refinamiento
- Comando «Registrar una iteración del prompt» (también desde el constructor y la tabla). `ui/IterationModal.ts` pide síntomas D01–D14, el elemento ajustado (uno por iteración), el resultado (mejoró, igual, empeoró), una nota, el prompt resultante y el estado.
- `core/diagnostics.ts`: catálogo de síntomas con el elemento que corrige cada uno (`DIAGNOSTIC_TARGET`); los textos están en los archivos de idioma. `STOP_AFTER = 3`: con tres iteraciones seguidas sin mejora se recomienda adjuntar un documento de referencia (D14) en vez de seguir ajustando.
- `core/iteration.ts` (puro) arma las entradas de bitácora y los contadores; `services/logs.ts` las escribe.
- Cada prompt tiene una bitácora propia en la carpeta de bitácoras (`tipo: bitacora`, `prompt: "[[Nota]]"`). Guarda el prompt inicial (versión 1) y, por iteración, síntomas, elemento, resultado, nota y el prompt resultante en un callout plegado.
- La nota del prompt conserva solo la versión vigente y los contadores `version`, `iteraciones` e `iteraciones_sin_mejora`. La versión sube solo si el prompt cambió.

## Versión 1.0: bloques, ejemplos y meta-prompts
- **Bloques** (`tipo: bloque`, carpeta de bloques): fragmentos de texto. Su identificador es `bloque_id` o, si falta, el nombre del archivo en minúsculas y con guiones. Las notas los piden con `bloques: [id, ...]`. `no-inventar` tiene un texto de respaldo incorporado.
- **Bancos de ejemplos** (`tipo: ejemplos`): un encabezado `### Ejemplo N` con `**Entrada**` y `**Salida**`. Se enlazan con `ejemplos_ref`. Few-shot exige entre 2 y 5.
- **Orden del prompt final** (`core/builder.ts`, `composePrompt`): prompt, ejemplos, bloques y, al final, el perfil de estilo. Las variables se reemplazan una sola vez sobre el texto compuesto, así que los bloques también pueden llevar `{{variables}}`.
- **Meta-prompts** (`tipo: meta-prompt`, carpeta de meta-prompts): cumplen el mismo mínimo que un prompt. «Mejorar este prompt» elige uno y abre el constructor con la variable `{{prompt}}` ya completada con el prompt de la nota activa. Solo prepara texto: se copia y se pega a mano.
- **Modo paso a paso** del formulario: cinco campos, uno por elemento; arma el prompt y avisa cuál falta. La tarea es obligatoria.

## Versión 1.0: vista de tabla
- `ui/LibraryTableView.ts` abre una pestaña con todos los prompts; se ordena por columna (`core/table.ts`) y se filtra con los mismos filtros de la búsqueda. Cada fila tiene acceso a usar el prompt y a registrar una iteración.

## Versión 1.0: paquetes
- Un paquete es un archivo Markdown (`tipo: paquete`, `esquema_paquete: 1`) que guarda cada nota completa en un bloque de código `promptcraft-note`. La valla del bloque es más larga que cualquier secuencia de comillas de la nota (`core/pack.ts`).
- **Exportar** (`ui/ExportPackModal.ts`): se eligen las notas; los bloques y bancos de ejemplos que usan se agregan solos. No se incluyen bitácoras. El archivo queda en la carpeta de paquetes.
- **Importar** (`ui/ImportPackModal.ts`): se elige un paquete de la bóveda, se ve qué se instalaría y se elige qué hacer con lo que ya existe (omitir o crear una copia numerada). Nunca se sobrescribe. Los prompts importados vuelven a la versión 1, sin contadores, y quedan marcados con `origen: importado`. Los dominios nuevos se agregan a los ajustes.
- `core/install.ts` decide la carpeta de cada tipo y el plan de instalación; lo comparten la importación y el paquete inicial.
- **Paquete inicial**: comando «Instalar el paquete inicial», casilla al final del asistente y botón en los ajustes. Se instala en el idioma activo.

## Pruebas
- Toda la lógica está en `core` y se prueba sin Obsidian. `tests/stubs/obsidian.ts` (con el alias de `vitest.config.ts`) y una bóveda simulada en `tests/services.test.ts` permiten probar los servicios: instalar el paquete inicial, registrar iteraciones y exportar e importar.
- `tests/i18n-usage.test.ts` revisa que toda clave de texto usada en el código exista en español.

## Pantalla de inicio
- `ui/HomeView.ts` (comando «Abrir la pantalla de inicio» y primera entrada del menú): pestaña con pasos para empezar (con botón que ejecuta cada paso), resumen de la biblioteca, avisos de qué revisar, accesos rápidos y ayuda breve del método y de las carpetas.
- `core/home.ts` (puro, con pruebas): `homeSteps`, `libraryStats` y `homeAlerts` (notas que no cumplen el mínimo, prompts con 3 o más iteraciones sin mejora y borradores sin cambios hace más de 30 días).
- Es interactiva: los pasos ejecutan su acción; «Continúa donde quedaste» lista los 5 prompts más recientes con abrir, usar e iterar; las tarjetas, los estados y los dominios abren la tabla ya filtrada (`activateTable({field, value})` → `LibraryTableView.setFilter`); «Tu material» muestra bloques, bancos, meta-prompts y paquetes con sus botones de crear y de mostrar la carpeta.
- Se actualiza sola al cambiar las notas de la biblioteca.
- Al abrir la bóveda se muestra el inicio (ajuste `openHomeOnStartup`, activado por defecto). Si ya hay una pestaña de inicio, se trae al frente en vez de abrir otra.
- Volver al inicio: segundo ícono en la barra lateral izquierda, primera entrada del menú, botón en la cabecera de toda nota de la biblioteca, en el panel lateral y en la tabla.

## Acciones en las notas y en las carpetas
- Las notas de la biblioteca muestran en su cabecera (`MarkdownView.addAction`) el botón de inicio y, si son prompt o meta-prompt, los de usar, registrar iteración y mejorar. Se actualizan al abrir notas, cambiar el diseño o cambiar el frontmatter (`refreshNoteActions`).
- Clic derecho en una carpeta (`core/paths.ts`, `folderKind`): dominio → nueva nota de prompt; bloques → nuevo bloque; ejemplos → nuevo banco; meta-prompts → nuevo meta-prompt; paquetes → importar y exportar.
- En el formulario, los bloques se eligen en una ventana con búsqueda (`ui/BlockPickerModal.ts`) y los elegidos se ven como etiquetas.
