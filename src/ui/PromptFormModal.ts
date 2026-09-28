import { App, Modal, Setting } from "obsidian";
import { formatIssue } from "../core/issues";
import {
	DraftTipo,
	ElementTexts,
	PromptDraft,
	composeElements,
	emptyDraft,
	emptyElements,
	missingElements,
	validateDraft,
	withNoInvent,
} from "../core/note";
import { BLOQUE_NO_INVENTAR, ValidationIssue } from "../core/schema";
import { ELEMENTOS, ESTADOS, SENSIBILIDADES, TECNICAS, Estado, Sensibilidad, Tecnica } from "../core/vocab";
import { BlockNote } from "../core/blocks";
import { labelFor, t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { ExampleBank, loadBlocks, loadExampleBanks } from "../services/library";
import { ExamplesFormModal } from "./ExamplesFormModal";
import { BlockFormModal } from "./BlockFormModal";
import { BlockPickerModal } from "./BlockPickerModal";

const lines = (text: string): string[] =>
	text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);

export interface PromptFormOptions {
	/** Dominio preseleccionado (por ejemplo, al crear desde una carpeta). */
	dominio?: string;
	tipo?: DraftTipo;
}

/**
 * Formulario de nueva nota de prompt o de meta-prompt. Valida con las reglas del método antes
 * de guardar. El prompt se puede escribir de una vez o armar paso a paso con los cinco elementos.
 */
export class PromptFormModal extends Modal {
	private readonly draft: PromptDraft;
	private readonly elements: ElementTexts = emptyElements();
	private guided = false;
	private blocks: BlockNote[] = [];
	private banks: ExampleBank[] = [];
	private issuesEl!: HTMLElement;
	private missingEl: HTMLElement | null = null;

	constructor(
		app: App,
		private readonly plugin: PromptCraftPlugin,
		private readonly onSave: (draft: PromptDraft) => Promise<void>,
		private readonly options: PromptFormOptions = {},
	) {
		super(app);
		this.draft = emptyDraft();
		this.draft.tipo = options.tipo ?? "prompt";
		if (this.draft.tipo === "meta-prompt") {
			this.draft.tecnica = ["meta"];
			this.draft.dominio = "";
		} else {
			this.draft.dominio = options.dominio ?? plugin.settings.domains[0] ?? "";
		}
	}

	onOpen(): void {
		this.titleEl.setText(this.draft.tipo === "meta-prompt" ? t("form.title.meta") : t("form.title"));
		void this.reloadAndRender();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async reloadAndRender(): Promise<void> {
		const paths = this.plugin.getPaths();
		[this.blocks, this.banks] = await Promise.all([loadBlocks(this.app, paths), loadExampleBanks(this.app, paths)]);
		this.render();
	}

	private usesFewShot(): boolean {
		return this.draft.tecnica.includes("few-shot") || this.draft.tecnica.includes("few-shot+cot");
	}

	private usesCot(): boolean {
		return this.draft.tecnica.includes("chain-of-thought") || this.draft.tecnica.includes("few-shot+cot");
	}

	private render(): void {
		const { contentEl } = this;
		const d = this.draft;
		const vocab = this.plugin.settings.vocab;
		contentEl.empty();
		contentEl.addClass("prompt-craft-form");

		new Setting(contentEl).setName(t("field.titulo")).addText((text) =>
			text
				.setPlaceholder(t("form.titulo.placeholder"))
				.setValue(d.titulo)
				.onChange((v) => (d.titulo = v)),
		);

		if (d.tipo === "prompt") {
			new Setting(contentEl)
				.setName(t("form.dominio"))
				.setDesc(t("form.dominio.desc"))
				.addDropdown((dd) => {
					dd.addOption("", t("form.dominio.none"));
					const known = this.plugin.settings.domains;
					for (const domain of known) dd.addOption(domain, domain);
					if (d.dominio && !known.includes(d.dominio)) dd.addOption(d.dominio, d.dominio);
					dd.setValue(d.dominio).onChange((v) => (d.dominio = v));
				});
		}

		this.textArea(t("field.tarea_que_resuelve"), t("form.tarea_que_resuelve.desc"), d.tarea_que_resuelve, 2, (v) => (d.tarea_que_resuelve = v));
		this.textArea(t("field.nota_reutilizacion"), t("form.nota_reutilizacion.desc"), d.nota_reutilizacion, 2, (v) => (d.nota_reutilizacion = v));

		new Setting(contentEl).setName(t("field.tecnica")).addDropdown((dd) => {
			for (const v of TECNICAS) dd.addOption(v, labelFor("tecnica", v));
			dd.setValue(d.tecnica[0] ?? "estructurado").onChange((v) => {
				d.tecnica = [v as Tecnica];
				this.render();
			});
		});

		new Setting(contentEl).setName(t("field.sensibilidad")).addDropdown((dd) => {
			for (const v of SENSIBILIDADES) dd.addOption(v, labelFor("sensibilidad", v));
			dd.setValue(d.sensibilidad).onChange((v) => {
				d.sensibilidad = v as Sensibilidad;
				if (d.sensibilidad === "contexto-sensible") d.bloques = withNoInvent(d.bloques, true);
				this.render();
			});
		});

		new Setting(contentEl)
			.setName(t("form.noInvent"))
			.setDesc(t("form.noInvent.desc"))
			.addToggle((toggle) =>
				toggle.setValue(d.bloques.includes(BLOQUE_NO_INVENTAR)).onChange((on) => {
					d.bloques = withNoInvent(d.bloques, on);
				}),
			);

		this.blocksPicker();

		new Setting(contentEl).setName(t("field.estado")).addDropdown((dd) => {
			for (const v of ESTADOS) dd.addOption(v, labelFor("estado", v));
			dd.setValue(d.estado).onChange((v) => (d.estado = v as Estado));
		});

		this.openVocabDropdown(t("form.tarea"), "tarea", vocab.tarea, d.tarea, (list) => (d.tarea = list));
		if (d.tipo === "prompt") {
			this.openVocabDropdown(t("form.herramienta"), "herramienta", vocab.herramienta, d.herramienta, (list) => (d.herramienta = list));
			this.openVocabDropdown(t("form.sector"), "sector", vocab.sector, d.sector, (list) => (d.sector = list));
		}

		if (this.usesFewShot()) this.examplesPicker();
		if (this.usesCot()) {
			this.textArea(t("field.criterios"), t("form.criterios.desc"), d.criterios.join("\n"), 4, (v) => (d.criterios = lines(v)));
		}

		this.promptSection();

		this.issuesEl = contentEl.createDiv({ cls: "prompt-craft-issues-box" });

		new Setting(contentEl)
			.addButton((b) => b.setButtonText(t("form.cancel")).onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(t("form.save"))
					.setCta()
					.onClick(() => void this.save()),
			);
	}

	/** Bloques reutilizables: un botón abre la lista con búsqueda y los elegidos se ven como etiquetas. */
	private blocksPicker(): void {
		const d = this.draft;
		const chosen = d.bloques.filter((id) => id !== BLOQUE_NO_INVENTAR);
		const setting = new Setting(this.contentEl).setName(t("field.bloques")).setDesc(t("form.blocks.desc"));
		setting.addButton((b) =>
			b.setButtonText(t("form.blocks.new")).onClick(() => {
				new BlockFormModal(this.app, this.plugin, () => void this.reloadAndRender()).open();
			}),
		);
		setting.addButton((b) =>
			b
				.setButtonText(chosen.length ? t("form.blocks.choose.n", { count: chosen.length }) : t("form.blocks.choose"))
				.setDisabled(this.blocks.filter((x) => x.id !== BLOQUE_NO_INVENTAR).length === 0)
				.onClick(() => {
					const available = this.blocks.filter((x) => x.id !== BLOQUE_NO_INVENTAR);
					new BlockPickerModal(this.app, available, chosen, (ids) => {
						d.bloques = d.bloques.includes(BLOQUE_NO_INVENTAR) ? [...ids, BLOQUE_NO_INVENTAR] : ids;
						this.render();
					}).open();
				}),
		);
		if (chosen.length === 0) return;
		const row = this.contentEl.createDiv({ cls: "prompt-craft-selected-chips" });
		for (const id of chosen) {
			const title = this.blocks.find((b) => b.id === id)?.title ?? id;
			const chip = row.createSpan({ cls: "prompt-craft-chip prompt-craft-hue-0" });
			chip.createSpan({ text: title });
			const remove = chip.createSpan({ text: " ×", cls: "prompt-craft-chip-remove", attr: { "aria-label": t("form.blocks.remove") } });
			remove.addEventListener("click", () => {
				d.bloques = d.bloques.filter((x) => x !== id);
				this.render();
			});
		}
	}

	private examplesPicker(): void {
		const d = this.draft;
		const setting = new Setting(this.contentEl).setName(t("field.ejemplos_ref")).setDesc(t("form.ejemplos.desc"));
		setting.addDropdown((dd) => {
			dd.addOption("", t("form.none"));
			for (const bank of this.banks) dd.addOption(`[[${bank.link}]]`, `${bank.title} (${bank.count})`);
			if (d.ejemplos_ref && !this.banks.some((b) => `[[${b.link}]]` === d.ejemplos_ref)) {
				dd.addOption(d.ejemplos_ref, d.ejemplos_ref);
			}
			dd.setValue(d.ejemplos_ref).onChange((v) => (d.ejemplos_ref = v));
		});
		setting.addButton((b) =>
			b.setButtonText(t("form.ejemplos.new")).onClick(() => {
				new ExamplesFormModal(this.app, this.plugin, (link) => {
					d.ejemplos_ref = `[[${link}]]`;
					void this.reloadAndRender();
				}).open();
			}),
		);
	}

	/** El prompt: un solo texto o los cinco elementos por separado. */
	private promptSection(): void {
		const { contentEl } = this;
		const d = this.draft;

		new Setting(contentEl)
			.setName(t("form.guided"))
			.setDesc(t("form.guided.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.guided).onChange((on) => {
					this.guided = on;
					if (on) this.elements.tarea = this.elements.tarea || "";
					this.render();
				}),
			);

		if (!this.guided) {
			this.textArea(t("field.prompt"), t("form.prompt.desc"), d.prompt, 10, (v) => (d.prompt = v));
			return;
		}

		for (const key of ELEMENTOS) {
			this.textArea(labelFor("elemento", key), t(`form.el.${key}`), this.elements[key], key === "tarea" ? 3 : 2, (v) => {
				this.elements[key] = v;
				d.prompt = composeElements(this.elements);
				this.updateMissing();
			});
		}
		this.missingEl = contentEl.createDiv({ cls: "prompt-craft-missing" });
		this.updateMissing();
	}

	private updateMissing(): void {
		if (!this.missingEl) return;
		const missing = missingElements(this.elements);
		this.missingEl.setText(
			missing.length ? t("form.el.missing", { names: missing.map((k) => labelFor("elemento", k)).join(", ") }) : "",
		);
	}

	private textArea(name: string, desc: string, value: string, rows: number, onChange: (v: string) => void): void {
		const setting = new Setting(this.contentEl).setName(name).setDesc(desc);
		setting.settingEl.addClass("prompt-craft-stacked");
		setting.addTextArea((area) => {
			area.inputEl.rows = rows;
			area.setValue(value).onChange(onChange);
		});
	}

	/** Lista abierta con una opción vacía; guarda como máximo un valor. */
	private openVocabDropdown(
		name: string,
		field: string,
		options: string[],
		current: string[],
		onChange: (list: string[]) => void,
	): void {
		new Setting(this.contentEl).setName(name).addDropdown((dd) => {
			dd.addOption("", t("form.none"));
			for (const id of options) dd.addOption(id, labelFor(field, id));
			dd.setValue(current[0] ?? "").onChange((v) => onChange(v ? [v] : []));
		});
	}

	private showIssues(issues: ValidationIssue[], extra: string[]): void {
		this.issuesEl.empty();
		if (issues.length === 0 && extra.length === 0) return;
		this.issuesEl.createEl("p", { text: t("form.issues.heading"), cls: "prompt-craft-issues-heading" });
		const list = this.issuesEl.createEl("ul", { cls: "prompt-craft-issues" });
		for (const issue of issues) list.createEl("li", { text: formatIssue(issue) });
		for (const text of extra) list.createEl("li", { text });
		this.issuesEl.scrollIntoView({ block: "nearest" });
	}

	private async save(): Promise<void> {
		const bank = this.banks.find((b) => `[[${b.link}]]` === this.draft.ejemplos_ref);
		const issues = validateDraft(this.draft, bank?.count);
		// En el modo paso a paso, la tarea es el elemento que no puede faltar.
		const extra =
			this.guided && this.elements.tarea.trim() === "" ? [t("form.el.taskRequired")] : [];
		this.showIssues(issues, extra);
		if (issues.length > 0 || extra.length > 0) return;
		await this.onSave(this.draft);
		this.close();
	}
}
