import { App, Modal, Setting } from "obsidian";
import { WizardState, applyWizard, stateFromSettings, styleIsFilled } from "../core/wizard";
import { HERRAMIENTAS_INICIALES, SECTORES_EJEMPLO } from "../core/vocab";
import { LanguageSetting, labelFor, resolveLocale, setLocale, t } from "../i18n";
import type PromptCraftPlugin from "../main";

const TOTAL_STEPS = 5;

/** Asistente de primer uso: idioma, dominios, herramientas, sectores y perfil de estilo. */
export class WizardModal extends Modal {
	private readonly state: WizardState;
	private step = 0;
	private finished = false;

	constructor(
		app: App,
		private readonly plugin: PromptCraftPlugin,
	) {
		super(app);
		this.state = stateFromSettings(plugin.settings);
	}

	onOpen(): void {
		this.render();
	}

	onClose(): void {
		// Si se cierra sin terminar, el idioma vuelve al que estaba guardado.
		if (!this.finished) this.plugin.applyLocale();
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.titleEl.setText(t("wizard.title"));

		const progress = contentEl.createDiv({ cls: "prompt-craft-progress" });
		for (let i = 0; i < TOTAL_STEPS; i++) progress.createDiv({ cls: i <= this.step ? "is-done" : "" });
		contentEl.createEl("p", {
			text: t("wizard.step", { current: this.step + 1, total: TOTAL_STEPS }),
			cls: "prompt-craft-wizard-step",
		});

		switch (this.step) {
			case 0:
				this.stepLanguage();
				break;
			case 1:
				this.stepDomains();
				break;
			case 2:
				this.stepToolsAndSectors();
				break;
			case 3:
				this.stepStyle();
				break;
			default:
				this.stepSummary();
		}

		this.navigation();
	}

	private heading(title: string, intro: string): void {
		this.contentEl.createEl("h3", { text: title, cls: "prompt-craft-wizard-heading" });
		this.contentEl.createEl("p", { text: intro, cls: "prompt-craft-wizard-intro" });
	}

	private stepLanguage(): void {
		const s = this.state;
		this.heading(t("wizard.s1.title"), t("wizard.s1.intro"));

		new Setting(this.contentEl)
			.setName(t("settings.language.name"))
			.addDropdown((dd) =>
				dd
					.addOption("auto", t("settings.language.auto"))
					.addOption("es", t("settings.language.es"))
					.addOption("en", t("settings.language.en"))
					.setValue(s.language)
					.onChange((value) => {
						s.language = value as LanguageSetting;
						setLocale(resolveLocale(s.language, this.plugin.systemLanguage()));
						this.render();
					}),
			);

		const defaults = this.plugin.folderDefaults();
		new Setting(this.contentEl)
			.setName(t("settings.root.name"))
			.setDesc(t("settings.root.desc", { default: defaults.root }))
			.addText((text) =>
				text
					.setPlaceholder(defaults.root)
					.setValue(s.rootFolder)
					.onChange((v) => (s.rootFolder = v)),
			);
	}

	private stepDomains(): void {
		const s = this.state;
		this.heading(t("wizard.s2.title"), t("wizard.s2.intro"));
		this.textArea(t("settings.domains.name"), "", s.domainsText, 7, (v) => (s.domainsText = v), t("settings.domains.placeholder"));
	}

	private stepToolsAndSectors(): void {
		const s = this.state;
		this.heading(t("wizard.s3.title"), t("wizard.s3.intro"));

		this.checkGrid(t("wizard.s3.tools"), "herramienta", HERRAMIENTAS_INICIALES, s.herramientas);
		this.textArea(t("wizard.s3.toolsOther"), "", s.herramientasOtras, 3, (v) => (s.herramientasOtras = v));


		const examples = SECTORES_EJEMPLO.slice(0, 4).map((id) => labelFor("sector", id)).join("\n");
		this.textArea(t("wizard.s3.sectors"), t("wizard.s3.sectorsDesc"), s.sectoresText, 4, (v) => (s.sectoresText = v), examples);
	}

	private stepStyle(): void {
		const s = this.state;
		this.heading(t("wizard.s4.title"), t("wizard.s4.intro"));
		this.textArea(t("style.contextoBase.name"), t("style.contextoBase.desc"), s.contextoBase, 3, (v) => (s.contextoBase = v));
		this.textLine(t("style.idiomaVariante.name"), t("style.idiomaVariante.desc"), s.idiomaVariante, (v) => (s.idiomaVariante = v));
		this.textLine(t("style.tratamiento.name"), t("style.tratamiento.desc"), s.tratamiento, (v) => (s.tratamiento = v));
		this.textLine(t("style.registro.name"), t("style.registro.desc"), s.registro, (v) => (s.registro = v));
		this.textArea(t("style.terminos.name"), t("style.terminos.desc"), s.terminosText, 4, (v) => (s.terminosText = v));
		this.textLine(t("style.cierre.name"), t("style.cierre.desc"), s.cierre, (v) => (s.cierre = v));
	}

	private stepSummary(): void {
		this.heading(t("wizard.s5.title"), t("wizard.s5.intro"));
		const result = applyWizard(this.plugin.settings, this.state);
		const none = t("wizard.summary.none");
		const list = (items: string[], field?: string) =>
			items.length ? items.map((i) => (field ? labelFor(field, i) : i)).join(", ") : none;

		const root = result.rootFolder === "/" ? "/" : result.rootFolder || this.plugin.folderDefaults().root;
		const lines = [
			t("wizard.summary.root", { value: root }),
			t("wizard.summary.domains", { value: list(result.domains) }),
			t("wizard.summary.tools", { value: list(result.vocab.herramienta, "herramienta") }),
			t("wizard.summary.sectors", { value: list(result.vocab.sector, "sector") }),
			t("wizard.summary.style", {
				value: styleIsFilled(result.styleProfile) ? t("wizard.summary.styleFilled") : t("wizard.summary.styleEmpty"),
			}),
		];
		const ul = this.contentEl.createEl("ul");
		for (const line of lines) ul.createEl("li", { text: line });

		new Setting(this.contentEl)
			.setName(t("wizard.starter.name"))
			.setDesc(t("wizard.starter.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.state.installStarter).onChange((on) => (this.state.installStarter = on)),
			);
	}

	private navigation(): void {
		const setting = new Setting(this.contentEl);
		if (this.step > 0) {
			setting.addButton((b) =>
				b.setButtonText(t("wizard.back")).onClick(() => {
					this.step--;
					this.render();
				}),
			);
		}
		if (this.step < TOTAL_STEPS - 1) {
			setting.addButton((b) =>
				b
					.setButtonText(t("wizard.next"))
					.setCta()
					.onClick(() => {
						this.step++;
						this.render();
					}),
			);
		} else {
			setting.addButton((b) =>
				b
					.setButtonText(t("wizard.finish"))
					.setCta()
					.onClick(() => void this.finish()),
			);
		}
	}

	private async finish(): Promise<void> {
		this.finished = true;
		await this.plugin.completeSetup(this.state);
		this.close();
	}

	private textLine(name: string, desc: string, value: string, onChange: (v: string) => void): void {
		new Setting(this.contentEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) => text.setValue(value).onChange(onChange));
	}

	private textArea(
		name: string,
		desc: string,
		value: string,
		rows: number,
		onChange: (v: string) => void,
		placeholder = "",
	): void {
		const setting = new Setting(this.contentEl).setName(name);
		if (desc) setting.setDesc(desc);
		setting.settingEl.addClass("prompt-craft-stacked");
		setting.addTextArea((area) => {
			area.inputEl.rows = rows;
			area.setPlaceholder(placeholder).setValue(value).onChange(onChange);
		});
	}

	/** Casillas de un vocabulario inicial; modifica la lista recibida al marcar o desmarcar. */
	private checkGrid(name: string, field: string, ids: readonly string[], selected: string[]): void {
		this.contentEl.createEl("p", { text: name, cls: "prompt-craft-checks-title" });
		const grid = this.contentEl.createDiv({ cls: "prompt-craft-checks" });
		for (const id of ids) {
			const label = grid.createEl("label", { cls: "prompt-craft-check" });
			const input = label.createEl("input", { type: "checkbox" });
			input.checked = selected.includes(id);
			input.addEventListener("change", () => {
				const at = selected.indexOf(id);
				if (input.checked && at === -1) selected.push(id);
				if (!input.checked && at !== -1) selected.splice(at, 1);
			});
			label.createSpan({ text: labelFor(field, id) });
		}
	}
}
