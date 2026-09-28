import { MarkdownView, Menu, Notice, Plugin, TFile, TFolder, debounce, setIcon, stringifyYaml } from "obsidian";
import { FolderDefaults, LibraryPaths, buildPaths, folderKind } from "./core/paths";
import type { FilterField } from "./core/search";
import { PromptCraftSettings, mergeSettings } from "./core/settings";
import { WizardState, applyWizard } from "./core/wizard";
import { getLocale, Locale, resolveLocale, setLocale, t } from "./i18n";
import { ensureLibraryStructure, hasMissingFolders } from "./services/folders";
import { entryFromNote } from "./core/library";
import { cleanPromptText } from "./core/builder";
import { InstallStrategy, PlanItem, folderForNote, newDomains, planInstall, summarize } from "./core/install";
import type { DraftTipo } from "./core/note";
import { extractPromptSection } from "./core/schema";
import { createPromptNote, loadMetaPrompts, readNoteSource, validateFile, validateLibrary } from "./services/library";
import { installPlan } from "./services/packs";
import { starterNotes } from "./starter";
import { BlockFormModal } from "./ui/BlockFormModal";
import { BuilderModal } from "./ui/BuilderModal";
import { ExamplesFormModal } from "./ui/ExamplesFormModal";
import { ExportPackModal } from "./ui/ExportPackModal";
import { ImportPackModal } from "./ui/ImportPackModal";
import { IterationModal } from "./ui/IterationModal";
import { HOME_VIEW_TYPE, HomeView } from "./ui/HomeView";
import { LibraryTableView, TABLE_VIEW_TYPE } from "./ui/LibraryTableView";
import { MetaPromptSuggest } from "./ui/MetaPromptSuggest";
import { PromptCraftView, VIEW_TYPE } from "./ui/PromptCraftView";
import { PromptFormModal } from "./ui/PromptFormModal";
import type { SearchAction } from "./ui/SearchPanel";
import { SearchModal } from "./ui/SearchModal";
import { PromptCraftSettingTab } from "./ui/SettingsTab";
import { ValidationModal } from "./ui/ValidationModal";
import { WizardModal } from "./ui/WizardModal";

const COMMAND_IDS = [
	"create-folders", "open-wizard", "new-prompt", "new-meta-prompt", "new-block", "new-examples",
	"validate-note", "validate-library", "search-library", "use-prompt", "use-active-note",
	"improve-prompt", "record-iteration", "show-panel", "show-table", "show-home",
	"export-pack", "import-pack", "install-starter",
];

export default class PromptCraftPlugin extends Plugin {
	settings!: PromptCraftSettings;
	/** Idioma con el que se nombraron los comandos registrados. */
	private commandsLocale: Locale | null = null;
	private ribbonEl: HTMLElement | null = null;
	private homeRibbonEl: HTMLElement | null = null;
	private readonly noteActions = new Map<MarkdownView, HTMLElement[]>();
	private statusBarEl: HTMLElement | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.applyLocale();

		this.addSettingTab(new PromptCraftSettingTab(this.app, this));

		this.registerView(VIEW_TYPE, (leaf) => new PromptCraftView(leaf, this));
		this.registerView(HOME_VIEW_TYPE, (leaf) => new HomeView(leaf, this));
		this.registerView(TABLE_VIEW_TYPE, (leaf) => new LibraryTableView(leaf, this));
		this.registerCommands();

		// Clic derecho en una carpeta de la biblioteca: crear lo que corresponde a esa carpeta.
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFolder)) return;
				const kind = folderKind(this.getPaths(), file.path);
				if (kind === null) return;
				const add = (title: string, icon: string, action: () => void) =>
					menu.addItem((item) => item.setTitle(title).setIcon(icon).onClick(action));
				switch (kind.kind) {
					case "prompts":
						add(t("menu.newHere"), "file-plus", () => this.openNewPromptForm(kind.dominio));
						break;
					case "blocks":
						add(t("menu.newBlockHere"), "blocks", () => new BlockFormModal(this.app, this).open());
						break;
					case "examples":
						add(t("menu.newExamplesHere"), "list-plus", () => new ExamplesFormModal(this.app, this).open());
						break;
					case "metaPrompts":
						add(t("menu.newMetaHere"), "sparkles", () => this.openNewPromptForm(undefined, "meta-prompt"));
						break;
					case "packs":
						add(t("cmd.importPack"), "package-open", () => new ImportPackModal(this.app, this).open());
						add(t("cmd.exportPack"), "package", () => new ExportPackModal(this.app, this).open());
						break;
				}
			}),
		);

		// Botones en la cabecera de las notas de la biblioteca.
		const refreshActions = debounce(() => this.refreshNoteActions(), 200, true);
		this.registerEvent(this.app.workspace.on("file-open", refreshActions));
		this.registerEvent(this.app.workspace.on("layout-change", refreshActions));
		this.registerEvent(this.app.metadataCache.on("changed", refreshActions));

		this.app.workspace.onLayoutReady(() => {
			this.refreshNoteActions();
			// Primera vez: ofrece el asistente una sola vez, cuando la interfaz ya está lista.
			if (!this.settings.setupCompleted && !this.settings.setupPrompted) {
				this.settings.setupPrompted = true;
				void this.saveSettings();
				this.openWizard();
			}
			// Cada vez que se abre la bóveda se parte por la pantalla de inicio.
			if (this.settings.openHomeOnStartup) void this.activateHome();
		});
	}

	onunload(): void {
		this.removeNoteActions();
	}

	async loadSettings(): Promise<void> {
		this.settings = mergeSettings(await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/** Fija el idioma efectivo según el ajuste y el idioma de Obsidian. */
	applyLocale(): void {
		setLocale(resolveLocale(this.settings.language, this.systemLanguage()));
		// Obsidian no traduce solo los nombres de los comandos: se registran de nuevo si cambió el idioma.
		if (this.commandsLocale !== null && this.commandsLocale !== getLocale()) {
			for (const id of COMMAND_IDS) this.removeCommand(id);
			this.registerCommands();
		}
	}

	private registerCommands(): void {
		this.commandsLocale = getLocale();

		// Botón en la barra lateral izquierda; se vuelve a crear si cambia el idioma.
		this.ribbonEl?.remove();
		this.homeRibbonEl?.remove();
		this.homeRibbonEl = this.addRibbonIcon("layout-dashboard", t("cmd.showHome"), () => void this.activateHome());
		this.ribbonEl = this.addRibbonIcon("library", t("ribbon.tooltip"), (event) => this.showMenu(event));
		this.removeNoteActions();
		this.updateStatusBar();

		// Solo se ofrece cuando falta alguna carpeta (por ejemplo, tras agregar un dominio).
		this.addCommand({
			id: "create-folders",
			name: t("cmd.createFolders"),
			checkCallback: (checking) => {
				const paths = this.getPaths();
				if (!hasMissingFolders(this.app, paths, this.settings.domains)) return false;
				if (!checking) void this.createFolders();
				return true;
			},
		});

		this.addCommand({
			id: "open-wizard",
			name: t("cmd.openWizard"),
			callback: () => this.openWizard(),
		});

		this.addCommand({
			id: "show-panel",
			name: t("cmd.showPanel"),
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "show-home",
			name: t("cmd.showHome"),
			callback: () => void this.activateHome(),
		});

		this.addCommand({
			id: "show-table",
			name: t("cmd.showTable"),
			callback: () => void this.activateTable(),
		});

		this.addCommand({
			id: "search-library",
			name: t("cmd.searchLibrary"),
			callback: () => new SearchModal(this.app, this).open(),
		});

		this.addCommand({
			id: "use-prompt",
			name: t("cmd.usePrompt"),
			callback: () => new SearchModal(this.app, this, "use").open(),
		});

		this.addCommand({
			id: "use-active-note",
			name: t("cmd.useActiveNote"),
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (file && file.extension === "md") void this.openBuilder(file.path);
				else new Notice(t("notice.notMarkdown"));
			},
		});

		this.addCommand({
			id: "new-prompt",
			name: t("cmd.newPrompt"),
			callback: () => this.openNewPromptForm(),
		});

		this.addCommand({
			id: "new-meta-prompt",
			name: t("cmd.newMetaPrompt"),
			callback: () => this.openNewPromptForm(undefined, "meta-prompt"),
		});

		this.addCommand({
			id: "new-block",
			name: t("cmd.newBlock"),
			callback: () => new BlockFormModal(this.app, this).open(),
		});

		this.addCommand({
			id: "new-examples",
			name: t("cmd.newExamples"),
			callback: () => new ExamplesFormModal(this.app, this).open(),
		});

		this.addCommand({
			id: "improve-prompt",
			name: t("cmd.improvePrompt"),
			callback: () => void this.improveActivePrompt(),
		});

		this.addCommand({
			id: "record-iteration",
			name: t("cmd.recordIteration"),
			callback: () => this.recordIterationForActiveNote(),
		});

		this.addCommand({
			id: "export-pack",
			name: t("cmd.exportPack"),
			callback: () => new ExportPackModal(this.app, this).open(),
		});

		this.addCommand({
			id: "import-pack",
			name: t("cmd.importPack"),
			callback: () => new ImportPackModal(this.app, this).open(),
		});

		this.addCommand({
			id: "install-starter",
			name: t("cmd.installStarter"),
			callback: () => void this.installStarter(),
		});

		this.addCommand({
			id: "validate-note",
			name: t("cmd.validateNote"),
			callback: () => void this.validateActiveNote(),
		});

		this.addCommand({
			id: "validate-library",
			name: t("cmd.validateLibrary"),
			callback: () => void this.validateWholeLibrary(),
		});
	}

	/** Idioma de la interfaz de Obsidian, si se puede leer. */
	systemLanguage(): string | null {
		try {
			return window.localStorage.getItem("language");
		} catch {
			return null;
		}
	}

	openWizard(): void {
		new WizardModal(this.app, this).open();
	}

	/** Aplica lo ingresado en el asistente, lo guarda y crea la estructura de carpetas. */
	async completeSetup(state: WizardState): Promise<void> {
		this.settings = applyWizard(this.settings, state);
		await this.saveSettings();
		this.applyLocale();
		try {
			const { created } = await ensureLibraryStructure(this.app, this.getPaths(), this.settings.domains);
			new Notice(t("notice.setupDone", { count: created }));
			if (state.installStarter) await this.installStarter();
		} catch (error) {
			console.error("[prompt-craft-library] no se pudo crear la estructura", error);
			new Notice(t("notice.setupFoldersError"));
		}
	}

	/** Nombres de carpeta por defecto, en el idioma activo. */
	folderDefaults(): FolderDefaults {
		return {
			root: t("folder.root"),
			prompts: t("folder.prompts"),
			system: t("folder.system"),
			metaPrompts: t("folder.metaPrompts"),
			blocks: t("folder.blocks"),
			examples: t("folder.examples"),
			logs: t("folder.logs"),
			reference: t("folder.reference"),
			packs: t("folder.packs"),
		};
	}

	getPaths(): LibraryPaths {
		return buildPaths(this.settings.rootFolder, this.settings.folderNames, this.folderDefaults());
	}

	async createFolders(): Promise<void> {
		try {
			const { created } = await ensureLibraryStructure(
				this.app,
				this.getPaths(),
				this.settings.domains,
			);
			new Notice(
				created > 0 ? t("notice.foldersCreated", { count: created }) : t("notice.foldersUpToDate"),
			);
		} catch (error) {
			console.error("[prompt-craft-library] no se pudo crear la estructura", error);
			new Notice(t("notice.foldersError", { path: this.getPaths().root || "/" }));
		}
	}

	/** Menú del botón de la barra lateral: las acciones principales sin pasar por la paleta de comandos. */
	private showMenu(event: MouseEvent): void {
		const menu = new Menu();
		const add = (title: string, icon: string, action: () => void) =>
			menu.addItem((item) => item.setTitle(title).setIcon(icon).onClick(action));

		add(t("cmd.showHome"), "layout-dashboard", () => void this.activateHome());
		add(t("cmd.showPanel"), "panel-right", () => void this.activateView());
		add(t("cmd.showTable"), "table", () => void this.activateTable());
		add(t("cmd.searchLibrary"), "search", () => new SearchModal(this.app, this).open());
		add(t("cmd.usePrompt"), "wand-sparkles", () => new SearchModal(this.app, this, "use").open());
		menu.addSeparator();
		add(t("cmd.newPrompt"), "file-plus", () => this.openNewPromptForm());
		add(t("cmd.newMetaPrompt"), "sparkles", () => this.openNewPromptForm(undefined, "meta-prompt"));
		add(t("cmd.newBlock"), "blocks", () => new BlockFormModal(this.app, this).open());
		add(t("cmd.newExamples"), "list-plus", () => new ExamplesFormModal(this.app, this).open());
		menu.addSeparator();
		add(t("cmd.improvePrompt"), "wand", () => void this.improveActivePrompt());
		add(t("cmd.recordIteration"), "rotate-cw", () => this.recordIterationForActiveNote());
		menu.addSeparator();
		add(t("cmd.validateNote"), "circle-check", () => void this.validateActiveNote());
		add(t("cmd.validateLibrary"), "list-checks", () => void this.validateWholeLibrary());
		menu.addSeparator();
		add(t("cmd.exportPack"), "package", () => new ExportPackModal(this.app, this).open());
		add(t("cmd.importPack"), "package-open", () => new ImportPackModal(this.app, this).open());
		add(t("cmd.installStarter"), "gift", () => void this.installStarter());
		menu.addSeparator();
		add(t("cmd.openWizard"), "settings", () => this.openWizard());
		menu.showAtMouseEvent(event);
	}

	/** Muestra u oculta el acceso de la barra de estado según los ajustes. */
	updateStatusBar(): void {
		this.statusBarEl?.remove();
		this.statusBarEl = null;
		if (!this.settings.showStatusBar) return;

		const el = this.addStatusBarItem();
		el.addClass("mod-clickable");
		el.setAttribute("aria-label", t("statusbar.tooltip"));
		setIcon(el.createSpan({ cls: "prompt-craft-status-icon" }), "library");
		el.createSpan({ text: t("plugin.name") });
		el.addEventListener("click", (event) => this.showMenu(event));
		this.statusBarEl = el;
	}

	/** Abre el panel lateral, o lo trae al frente si ya está abierto. */
	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			await right.setViewState({ type: VIEW_TYPE, active: true });
			leaf = right;
		}
		void workspace.revealLeaf(leaf);
	}

	/** Abre la pantalla de inicio en una pestaña, o la trae al frente si ya está abierta. */
	async activateHome(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(HOME_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: HOME_VIEW_TYPE, active: true });
		}
		void workspace.revealLeaf(leaf);
	}

	/** Abre la tabla de la biblioteca en una pestaña, o la trae al frente; puede abrirla ya filtrada. */
	async activateTable(filter?: { field: FilterField; value: string }): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(TABLE_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: TABLE_VIEW_TYPE, active: true });
		}
		void workspace.revealLeaf(leaf);
		if (leaf.view instanceof LibraryTableView) leaf.view.setFilter(filter?.field, filter?.value);
	}

	/** Abre la nota o el constructor de un resultado de búsqueda. */
	async activateItem(path: string, action: SearchAction): Promise<void> {
		if (action === "use") {
			await this.openBuilder(path);
			return;
		}
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file);
	}

	/** Abre el constructor con el prompt de una nota. */
	async openBuilder(path: string, preset?: Record<string, string>): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		const entry = entryFromNote(await readNoteSource(this.app, file));
		if (extractPromptSection(entry.body) === "") {
			new Notice(t("notice.noPromptSection"));
			return;
		}
		new BuilderModal(this.app, this, entry, { preset }).open();
	}

	/** Abre una carpeta en el explorador de archivos, si se puede. */
	revealFolder(path: string): void {
		const folder = this.app.vault.getAbstractFileByPath(path);
		const explorer = this.app.workspace.getLeavesOfType("file-explorer")[0];
		const view = explorer?.view as unknown as { revealInFolder?: (f: unknown) => void } | undefined;
		if (folder && view?.revealInFolder) {
			view.revealInFolder(folder);
			void this.app.workspace.revealLeaf(explorer);
		} else {
			new Notice(t("notice.folderMissing", { path }));
		}
	}

	/** Abre los ajustes del plugin, si se puede. */
	openSettings(): void {
		const setting = (this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
		if (!setting) return;
		setting.open();
		setting.openTabById(this.manifest.id);
	}

	private removeNoteActions(): void {
		for (const els of this.noteActions.values()) els.forEach((el) => el.remove());
		this.noteActions.clear();
	}

	/**
	 * Botones de la cabecera de una nota: volver al inicio en toda nota de la biblioteca y,
	 * en los prompts y meta-prompts, usar, registrar iteración y mejorar.
	 */
	private refreshNoteActions(): void {
		const paths = this.getPaths();
		const live = new Set<MarkdownView>();
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			live.add(view);

			let els = this.noteActions.get(view);
			if (!els) {
				const fileOf = () => view.file;
				const promptOnly = (run: (file: TFile) => void) => () => {
					const file = fileOf();
					if (file) run(file);
				};
				els = [
					view.addAction("layout-dashboard", t("action.home"), () => void this.activateHome()),
					view.addAction("wand-sparkles", t("action.use"), promptOnly((f) => void this.openBuilder(f.path))),
					view.addAction("rotate-cw", t("cmd.recordIteration"), promptOnly((f) => new IterationModal(this.app, this, f).open())),
					view.addAction("wand", t("cmd.improvePrompt"), promptOnly(() => void this.improveActivePrompt())),
				];
				this.noteActions.set(view, els);
			}
			const file = view.file;
			const inLibrary = !!file && (file.path.startsWith(`${paths.prompts}/`) || file.path.startsWith(`${paths.system}/`));
			const tipo = file ? this.app.metadataCache.getFileCache(file)?.frontmatter?.tipo : undefined;
			const isPrompt = tipo === "prompt" || tipo === "meta-prompt";
			els[0].toggle(inLibrary);
			els.slice(1).forEach((el) => el.toggle(isPrompt));
		}
		for (const [view, els] of this.noteActions) {
			if (live.has(view)) continue;
			els.forEach((el) => el.remove());
			this.noteActions.delete(view);
		}
	}

	openNewPromptForm(dominio?: string, tipo: DraftTipo = "prompt"): void {
		new PromptFormModal(
			this.app,
			this,
			async (draft) => {
				try {
					const file = await createPromptNote(this.app, this.getPaths(), draft);
					new Notice(t("notice.noteCreated", { path: file.path }));
					await this.app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					console.error("[prompt-craft-library] no se pudo crear la nota", error);
					new Notice(t("notice.noteError"));
				}
			},
			{ dominio, tipo },
		).open();
	}

	/** Nota activa si es un prompt o un meta-prompt de la biblioteca. */
	private activePromptFile(): TFile | null {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			new Notice(t("notice.notMarkdown"));
			return null;
		}
		const tipo = this.app.metadataCache.getFileCache(file)?.frontmatter?.tipo;
		if (tipo !== "prompt" && tipo !== "meta-prompt") {
			new Notice(t("notice.notPrompt"));
			return null;
		}
		return file;
	}

	recordIterationForActiveNote(): void {
		const file = this.activePromptFile();
		if (file) new IterationModal(this.app, this, file).open();
	}

	/**
	 * «Mejorar este prompt»: elige un meta-prompt y abre el constructor con el prompt de la nota
	 * activa ya puesto en su variable {{prompt}}. El texto se copia y se pega a mano en la IA.
	 */
	async improveActivePrompt(): Promise<void> {
		const file = this.activePromptFile();
		if (!file) return;
		const source = extractPromptSection(entryFromNote(await readNoteSource(this.app, file)).body);
		if (source === "") {
			new Notice(t("notice.noPromptSection"));
			return;
		}
		const metas = await loadMetaPrompts(this.app, this.getPaths());
		if (metas.length === 0) {
			new Notice(t("meta.none"), 8000);
			return;
		}
		new MetaPromptSuggest(this.app, metas, (meta) => {
			void this.openBuilder(meta.path, { prompt: cleanPromptText(source) });
		}).open();
	}

	/** Instala las notas de un plan (paquete importado o inicial) y agrega los dominios nuevos. */
	async installPlan(plan: PlanItem[]): Promise<number> {
		const domains = newDomains(plan, this.settings.domains);
		const created = await installPlan(this.app, plan);
		if (domains.length > 0) {
			this.settings.domains = [...this.settings.domains, ...domains];
			await this.saveSettings();
		}
		return created;
	}

	/** Instala el paquete inicial en el idioma activo sin tocar lo que ya existe. */
	async installStarter(strategy: InstallStrategy = "skip"): Promise<void> {
		try {
			const paths = this.getPaths();
			const plan = planInstall(
				starterNotes(stringifyYaml),
				(note) => folderForNote(note, paths),
				(p) => this.app.vault.getAbstractFileByPath(p) !== null,
				strategy,
			);
			const summary = summarize(plan);
			const created = await this.installPlan(plan);
			new Notice(t("starter.done", { count: created, skipped: summary.skipped }), 8000);
		} catch (error) {
			console.error("[prompt-craft-library] no se pudo instalar el paquete inicial", error);
			new Notice(t("starter.error"));
		}
	}

	private async validateActiveNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			new Notice(t("notice.notMarkdown"));
			return;
		}
		const result = await validateFile(this.app, file);
		new ValidationModal(this.app, [result]).open();
	}

	private async validateWholeLibrary(): Promise<void> {
		const paths = this.getPaths();
		const results = await validateLibrary(this.app, paths);
		new ValidationModal(this.app, results, {
			libraryPath: paths.prompts,
			onOpenNote: (path) => {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file);
			},
		}).open();
	}
}
