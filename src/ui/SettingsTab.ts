import { App, PluginSettingTab, Setting } from "obsidian";
import { parseDomainList } from "../core/settings";
import { LanguageSetting, t } from "../i18n";
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
}
