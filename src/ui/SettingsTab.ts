import { App, PluginSettingTab, Setting } from "obsidian";
import { ClassificationDefaults, emptyClassificationDefaults, parseDomainList } from "../core/settings";
import { ESTADOS, Estado, SENSIBILIDADES, Sensibilidad } from "../core/vocab";
import { LanguageSetting, labelFor, t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { ExportPackModal } from "./ExportPackModal";
import { ImportPackModal } from "./ImportPackModal";

export class PromptCraftSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: PromptCraftPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName(t("settings.title")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.language.name"))
			.setDesc(t("settings.language.desc"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("auto", t("settings.language.auto"))
					.addOption("es", t("settings.language.es"))
					.addOption("en", t("settings.language.en"))
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language = value as LanguageSetting;
						await this.plugin.saveSettings();
						this.plugin.applyLocale();
						this.display();
					}),
			);

		const defaults = this.plugin.folderDefaults();
		new Setting(containerEl)
			.setName(t("settings.root.name"))
			.setDesc(t("settings.root.desc", { default: defaults.root }))
			.addText((text) =>
				text
					.setPlaceholder(defaults.root)
					.setValue(this.plugin.settings.rootFolder)
					.onChange(async (value) => {
						this.plugin.settings.rootFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.domains.name"))
			.setDesc(t("settings.domains.desc", { prompts: defaults.prompts }))
			.addTextArea((area) => {
				area.inputEl.rows = 6;
				area
					.setPlaceholder(t("settings.domains.placeholder"))
					.setValue(this.plugin.settings.domains.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.domains = parseDomainList(value);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(t("settings.statusBar.name"))
			.setDesc(t("settings.statusBar.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
					this.plugin.settings.showStatusBar = value;
					await this.plugin.saveSettings();
					this.plugin.updateStatusBar();
				}),
			);

		new Setting(containerEl)
			.setName(t("settings.home.name"))
			.setDesc(t("settings.home.desc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.openHomeOnStartup).onChange(async (value) => {
					this.plugin.settings.openHomeOnStartup = value;
					await this.plugin.saveSettings();
				}),
			);

		this.defaultsSection(containerEl);

		new Setting(containerEl).setName(t("settings.packs.heading")).setHeading();
		new Setting(containerEl)
			.setName(t("settings.packs.starter.name"))
			.setDesc(t("settings.packs.starter.desc"))
			.addButton((button) =>
				button.setButtonText(t("cmd.installStarter")).onClick(() => void this.plugin.installStarter()),
			);
		new Setting(containerEl)
			.setName(t("settings.packs.share.name"))
			.setDesc(t("settings.packs.share.desc"))
			.addButton((button) =>
				button.setButtonText(t("cmd.importPack")).onClick(() => new ImportPackModal(this.app, this.plugin).open()),
			)
			.addButton((button) =>
				button.setButtonText(t("cmd.exportPack")).onClick(() => new ExportPackModal(this.app, this.plugin).open()),
			);

		new Setting(containerEl)
			.setName(t("settings.wizard.name"))
			.setDesc(t("settings.wizard.desc"))
			.addButton((button) =>
				button.setButtonText(t("settings.wizard.button")).onClick(() => this.plugin.openWizard()),
			);
	}

	/** Valores con que abre el formulario de nueva nota: uno general y excepciones por dominio. */
	private defaultsSection(containerEl: HTMLElement): void {
		const settings = this.plugin.settings;
		new Setting(containerEl).setName(t("settings.defaults.heading")).setHeading();
		containerEl.createEl("p", { text: t("settings.defaults.desc"), cls: "setting-item-description" });

		const row = (name: string, desc: string, target: ClassificationDefaults, emptyLabel: string, onChange: () => Promise<void>) => {
			const setting = new Setting(containerEl).setName(name).setDesc(desc);
			setting.settingEl.addClass("prompt-craft-defaults-row");
			const dropdown = (label: string, options: [string, string][], value: string, set: (v: string) => void) =>
				setting.addDropdown((dd) => {
					dd.addOption("", `${label}: ${emptyLabel}`);
					for (const [id, text] of options) dd.addOption(id, `${label}: ${text}`);
					if (value && !options.some(([id]) => id === value)) dd.addOption(value, `${label}: ${value}`);
					dd.setValue(value).onChange(async (v) => {
						set(v);
						await onChange();
					});
				});
			dropdown(
				t("form.herramienta"),
				settings.vocab.herramienta.map((id) => [id, labelFor("herramienta", id)]),
				target.herramienta,
				(v) => (target.herramienta = v),
			);
			dropdown(
				t("field.sensibilidad"),
				SENSIBILIDADES.map((id) => [id, labelFor("sensibilidad", id)]),
				target.sensibilidad,
				(v) => (target.sensibilidad = v as Sensibilidad | ""),
			);
			dropdown(
				t("field.estado"),
				ESTADOS.map((id) => [id, labelFor("estado", id)]),
				target.estado,
				(v) => (target.estado = v as Estado | ""),
			);
		};

		row(t("settings.defaults.general"), t("settings.defaults.general.desc"), settings.defaults, t("settings.defaults.none"), () =>
			this.plugin.saveSettings(),
		);
		for (const dominio of settings.domains) {
			const target = settings.defaults.porDominio[dominio] ?? emptyClassificationDefaults();
			row(dominio, t("settings.defaults.domain.desc"), target, t("settings.defaults.inherit"), async () => {
				const used = target.herramienta || target.sensibilidad || target.estado;
				if (used) settings.defaults.porDominio[dominio] = target;
				else delete settings.defaults.porDominio[dominio];
				await this.plugin.saveSettings();
			});
		}
	}
}
