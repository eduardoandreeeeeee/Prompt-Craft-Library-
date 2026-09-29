import { App, ButtonComponent, Modal, Notice, Setting, TFile } from "obsidian";
import { buildFinalPrompt, composePrompt, examplesAdvice, sensitivityAdvice } from "../core/builder";
import type { LibraryEntry } from "../core/library";
import { extractPromptSection } from "../core/schema";
import { styleVariableValues } from "../core/style";
import { extractVariables, initialValues } from "../core/variables";
import { styleIsFilled } from "../core/wizard";
import { t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { PromptExtrasData, loadPromptExtras } from "../services/library";
import { IterationModal } from "./IterationModal";

export interface BuilderOptions {
	/** Valores con los que arrancan las variables (por ejemplo, el prompt a mejorar). */
	preset?: Record<string, string>;
}

/**
 * Completa las variables de un prompt, le suma sus ejemplos y bloques, avisa según su
 * sensibilidad y copia el resultado. Nada se envía a ninguna IA: el texto se copia y se pega a mano.
 */
export class BuilderModal extends Modal {
	private readonly section: string;
	private values: Record<string, string>;
	private extras: PromptExtrasData | null = null;
	private includeStyle: boolean;
	private confirmed = false;

	private previewEl!: HTMLTextAreaElement;
	private missingEl!: HTMLElement;
	private copyButton!: ButtonComponent;

	constructor(
		app: App,
		private readonly plugin: PromptCraftPlugin,
		private readonly entry: LibraryEntry,
		private readonly options: BuilderOptions = {},
	) {
		super(app);
		this.section = extractPromptSection(entry.body);
		this.values = { ...(options.preset ?? {}) };
		this.includeStyle = styleIsFilled(plugin.settings.styleProfile);
	}

	onOpen(): void {
		void this.init();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async init(): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.entry.path);
		if (file instanceof TFile) {
			this.extras = await loadPromptExtras(this.app, this.plugin.getPaths(), file, this.entry.frontmatter);
		}
		// Las variables con el nombre de un campo del perfil de estilo arrancan con ese valor.
		const variables = extractVariables(composePrompt(this.section, this.promptExtras()));
		this.values = initialValues(variables, this.values, styleVariableValues(this.plugin.settings.styleProfile));
		this.render(file instanceof TFile ? file : null);
	}

	private promptExtras() {
		return { examples: this.extras?.examplesText, blocks: this.extras?.blockTexts };
	}

	private render(file: TFile | null): void {
		const { contentEl } = this;
		const fm = this.entry.frontmatter;
		this.titleEl.setText(t("builder.title", { title: this.entry.title }));
		contentEl.empty();
		contentEl.addClass("prompt-craft-builder");

		this.warnings(sensitivityAdvice(fm.sensibilidad, fm.bloques));
		this.extrasNotes(fm);

		const variables = extractVariables(composePrompt(this.section, this.promptExtras()));
		if (variables.length === 0) {
			contentEl.createEl("p", { text: t("builder.noVariables"), cls: "prompt-craft-muted" });
		}
		for (const variable of variables) {
			const setting = new Setting(contentEl).setName(variable.name);
			if (variable.hint) setting.setDesc(variable.hint);
			setting.settingEl.addClass("prompt-craft-stacked");
			setting.addTextArea((area) => {
				area.inputEl.rows = this.values[variable.name] ? 6 : 2;
				area
					.setPlaceholder(variable.defaultValue ?? "")
					.setValue(this.values[variable.name] ?? "")
					.onChange((v) => {
						this.values[variable.name] = v;
						this.update();
					});
			});
		}

		if (styleIsFilled(this.plugin.settings.styleProfile)) {
			new Setting(contentEl)
				.setName(t("builder.style"))
				.setDesc(t("builder.style.desc"))
				.addToggle((toggle) =>
					toggle.setValue(this.includeStyle).onChange((on) => {
						this.includeStyle = on;
						this.update();
					}),
				);
		}

		contentEl.createEl("h3", { text: t("builder.preview"), cls: "prompt-craft-wizard-heading" });
		this.previewEl = contentEl.createEl("textarea", { cls: "prompt-craft-preview" });
		this.previewEl.readOnly = true;
		this.previewEl.rows = 10;
		this.missingEl = contentEl.createDiv({ cls: "prompt-craft-missing" });

		const footer = new Setting(contentEl);
		if (file) {
			footer.addButton((b) =>
				b
					.setButtonText(t("builder.iterate"))
					.setTooltip(t("builder.iterate.tip"))
					.onClick(() => {
						this.close();
						new IterationModal(this.app, this.plugin, file).open();
					}),
			);
		}
		footer
			.addButton((b) => b.setButtonText(t("validate.close")).onClick(() => this.close()))
			.addButton((b) => {
				this.copyButton = b;
				b.setButtonText(t("builder.copy")).setCta().onClick(() => void this.copy());
			});

		this.update();
	}

	/** Qué se agregó al prompt (ejemplos y bloques) y qué falta. */
	private extrasNotes(fm: Record<string, unknown>): void {
		const extras = this.extras;
		if (!extras) return;
		const notes: string[] = [];
		if (extras.examplesCount !== undefined && extras.examplesCount > 0) {
			notes.push(t("builder.includes.examples", { count: extras.examplesCount }));
		}
		if (extras.blockTexts.length > 0) notes.push(t("builder.includes.blocks", { count: extras.blockTexts.length }));
		for (const note of notes) this.contentEl.createEl("p", { text: note, cls: "prompt-craft-muted" });

		const warnings: string[] = [];
		const advice = examplesAdvice(fm.tecnica, extras.examplesCount);
		if (advice === "missing") warnings.push(t("builder.warn.fewShotMissing"));
		if (advice === "range") warnings.push(t("builder.warn.fewShotRange", { count: extras.examplesCount ?? 0 }));
		if (extras.missingBlocks.length) warnings.push(t("builder.warn.blocksMissing", { names: extras.missingBlocks.join(", ") }));
		if (warnings.length) {
			const box = this.contentEl.createDiv({ cls: "prompt-craft-warning is-personal" });
			for (const w of warnings) box.createEl("p", { text: w });
		}
	}

	private warnings(advice: ReturnType<typeof sensitivityAdvice>): void {
		if (advice.level === "general") return;
		const box = this.contentEl.createDiv({
			cls: `prompt-craft-warning ${advice.level === "sensitive" ? "is-sensitive" : "is-personal"}`,
		});
		box.createEl("p", {
			text: advice.level === "personal" ? t("builder.warn.personal") : t("builder.warn.sensitive"),
		});
		if (advice.missingNoInvent) box.createEl("p", { text: t("builder.warn.noInvent") });

		if (advice.requiresConfirmation) {
			new Setting(this.contentEl).setName(t("builder.confirm")).addToggle((toggle) =>
				toggle.setValue(false).onChange((on) => {
					this.confirmed = on;
					this.update();
				}),
			);
		}
	}

	private result() {
		return buildFinalPrompt(
			this.section,
			this.values,
			this.includeStyle ? this.plugin.settings.styleProfile : null,
			this.promptExtras(),
		);
	}

	private update(): void {
		const result = this.result();
		this.previewEl.value = result.text;
		this.missingEl.setText(result.missing.length ? t("builder.missing", { names: result.missing.join(", ") }) : "");

		const advice = sensitivityAdvice(this.entry.frontmatter.sensibilidad, this.entry.frontmatter.bloques);
		this.copyButton.setDisabled(advice.requiresConfirmation && !this.confirmed);
	}

	private async copy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(this.result().text);
			new Notice(t("builder.copied"));
			this.close();
		} catch {
			this.previewEl.select();
			new Notice(t("builder.copyError"));
		}
	}
}
