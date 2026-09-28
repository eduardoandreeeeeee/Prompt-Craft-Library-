import { ItemView, TFile, WorkspaceLeaf, debounce, setIcon } from "obsidian";
import { hueIndex } from "../core/hue";
import { HomeAlert, StepId, homeAlerts, homeSteps, libraryStats, recentItems } from "../core/home";
import type { SearchItem } from "../core/search";
import { ELEMENTOS } from "../core/vocab";
import { labelFor, t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { hasMissingFolders } from "../services/folders";
import { loadBlocks, loadExampleBanks, loadMetaPrompts, loadSearchItems, validateLibrary } from "../services/library";
import { packFiles } from "../services/packs";
import { BlockFormModal } from "./BlockFormModal";
import { ExamplesFormModal } from "./ExamplesFormModal";
import { IterationModal } from "./IterationModal";
import { ExportPackModal } from "./ExportPackModal";
import { ImportPackModal } from "./ImportPackModal";
import { SearchModal } from "./SearchModal";

export const HOME_VIEW_TYPE = "prompt-craft-home";
const DOMAIN_HUES = 6;

const STEP_KEYS: Record<StepId, { title: Parameters<typeof t>[0]; desc: Parameters<typeof t>[0]; button: Parameters<typeof t>[0] }> = {
	wizard: { title: "home.step.wizard", desc: "home.step.wizard.desc", button: "settings.wizard.button" },
	folders: { title: "home.step.folders", desc: "home.step.folders.desc", button: "cmd.createFolders" },
	starter: { title: "home.step.starter", desc: "home.step.starter.desc", button: "cmd.installStarter" },
	prompt: { title: "home.step.prompt", desc: "home.step.prompt.desc", button: "cmd.newPrompt" },
};

const ALERT_KEYS: Record<HomeAlert["kind"], Parameters<typeof t>[0]> = {
	invalid: "home.alert.invalid",
	stalled: "home.alert.stalled",
	oldDraft: "home.alert.oldDraft",
};

/** Pantalla de inicio: cómo empezar, resumen de la biblioteca, qué revisar y accesos rápidos. */
export class HomeView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PromptCraftPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return HOME_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("home.title");
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	async onOpen(): Promise<void> {
		await this.render();
		const reload = debounce(() => void this.render(), 800, true);
		const inLibrary = (path: string) => {
			const p = this.plugin.getPaths();
			return path.startsWith(`${p.prompts}/`) || path.startsWith(`${p.system}/`);
		};
		this.registerEvent(this.app.metadataCache.on("changed", (file) => inLibrary(file.path) && reload()));
		this.registerEvent(this.app.vault.on("delete", (file) => inLibrary(file.path) && reload()));
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => (inLibrary(file.path) || inLibrary(oldPath)) && reload()),
		);
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private async render(): Promise<void> {
		const paths = this.plugin.getPaths();
		const [items, results, blocks, banks, metas] = await Promise.all([
			loadSearchItems(this.app, paths),
			validateLibrary(this.app, paths),
			loadBlocks(this.app, paths),
			loadExampleBanks(this.app, paths),
			loadMetaPrompts(this.app, paths),
		]);
		const packs = packFiles(this.app, paths);
		const stats = libraryStats(items);
		const steps = homeSteps({
			setupCompleted: this.plugin.settings.setupCompleted,
			foldersMissing: hasMissingFolders(this.app, paths, this.plugin.settings.domains),
			blockCount: blocks.length,
			promptCount: items.length,
		});

		const root = this.contentEl;
		root.empty();
		root.addClass("prompt-craft-home");

		const header = root.createDiv({ cls: "prompt-craft-home-header" });
		const top = header.createDiv({ cls: "prompt-craft-home-top" });
		top.createEl("h1", { text: t("plugin.name") });
		const tools = top.createDiv({ cls: "prompt-craft-home-tools" });
		const tool = (icon: string, label: string, action: () => void) => {
			const b = tools.createEl("button", { cls: "clickable-icon", attr: { "aria-label": label } });
			setIcon(b, icon);
			b.addEventListener("click", action);
		};
		tool("refresh-cw", t("panel.refresh"), () => void this.render());
		tool("settings", t("home.settings"), () => this.plugin.openSettings());
		header.createEl("p", { text: t("home.tagline"), cls: "prompt-craft-muted" });

		if (steps.some((s) => !s.done)) this.renderSteps(root, steps);
		this.renderRecent(root, items);
		this.renderSummary(root, stats);
		this.renderMaterial(root, { blocks: blocks.length, banks: banks.length, metas: metas.length, packs: packs.length });
		await this.renderAlerts(root, items, results);
		this.renderQuick(root);
		this.renderHelp(root);
	}

	private section(root: HTMLElement, title: string): HTMLElement {
		const box = root.createDiv({ cls: "prompt-craft-home-section" });
		box.createEl("h2", { text: title });
		return box;
	}

	private stepAction(id: StepId): void {
		switch (id) {
			case "wizard":
				this.plugin.openWizard();
				break;
			case "folders":
				void this.plugin.createFolders().then(() => this.render());
				break;
			case "starter":
				void this.plugin.installStarter().then(() => this.render());
				break;
			case "prompt":
				this.plugin.openNewPromptForm();
				break;
		}
	}

	private renderSteps(root: HTMLElement, steps: ReturnType<typeof homeSteps>): void {
		const box = this.section(root, t("home.steps"));
		box.createEl("p", { text: t("home.steps.desc"), cls: "prompt-craft-muted" });
		const list = box.createEl("ol", { cls: "prompt-craft-home-steps" });
		for (const step of steps) {
			const keys = STEP_KEYS[step.id];
			const li = list.createEl("li", { cls: step.done ? "is-done" : "" });
			const mark = li.createSpan({ cls: "prompt-craft-home-mark" });
			setIcon(mark, step.done ? "check-circle-2" : "circle");
			const text = li.createDiv({ cls: "prompt-craft-home-step-text" });
			text.createDiv({ text: t(keys.title), cls: "prompt-craft-home-step-title" });
			text.createDiv({ text: t(keys.desc), cls: "prompt-craft-muted" });
			if (!step.done) {
				li.createEl("button", { text: t(keys.button), cls: "mod-cta" }).addEventListener("click", () => this.stepAction(step.id));
			}
		}
	}

	private renderSummary(root: HTMLElement, stats: ReturnType<typeof libraryStats>): void {
		const box = this.section(root, t("home.summary"));
		if (stats.total === 0) {
			box.createEl("p", { text: t("search.emptyLibrary"), cls: "prompt-craft-muted" });
			return;
		}
		const cards = box.createDiv({ cls: "prompt-craft-home-cards" });
		const card = (value: number, label: string) => {
			const c = cards.createEl("button", { cls: "prompt-craft-home-card" });
			c.createDiv({ text: String(value), cls: "prompt-craft-home-number" });
			c.createDiv({ text: label, cls: "prompt-craft-muted" });
			c.addEventListener("click", () => void this.plugin.activateTable());
		};
		card(stats.total, t("home.summary.prompts"));
		card(stats.iterations, t("home.summary.iterations"));
		card(stats.byDominio.length, t("home.summary.domains"));

		const states = box.createDiv({ cls: "prompt-craft-home-row" });
		for (const { estado, count } of stats.byEstado) {
			if (count === 0) continue;
			const state = states.createEl("button", { cls: "prompt-craft-state prompt-craft-home-link" });
			state.setAttribute("data-estado", estado);
			state.createSpan({ cls: "prompt-craft-dot" });
			state.appendText(`${labelFor("estado", estado)}: ${count}`);
			state.addEventListener("click", () => void this.plugin.activateTable({ field: "estado", value: estado }));
		}
		if (stats.byDominio.length) {
			const domains = box.createDiv({ cls: "prompt-craft-home-row" });
			for (const { dominio, count } of stats.byDominio) {
				const group = domains.createSpan({ cls: "prompt-craft-home-domain" });
				const chip = group.createEl("button", {
					text: `${dominio} · ${count}`,
					cls: `prompt-craft-chip prompt-craft-home-link prompt-craft-hue-${hueIndex(dominio, DOMAIN_HUES)}`,
				});
				chip.addEventListener("click", () => void this.plugin.activateTable({ field: "dominio", value: dominio }));
				const add = group.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("menu.newHere") } });
				setIcon(add, "plus");
				add.addEventListener("click", () => this.plugin.openNewPromptForm(dominio));
			}
		}
		box.createDiv({ cls: "prompt-craft-home-row" }).createEl("button", { text: t("home.summary.table") }).addEventListener("click", () => void this.plugin.activateTable());
	}

	/** Los últimos prompts modificados, con acceso directo para abrirlos, usarlos o iterarlos. */
	private renderRecent(root: HTMLElement, items: SearchItem[]): void {
		const recent = recentItems(items, 5);
		if (recent.length === 0) return;
		const box = this.section(root, t("home.recent"));
		for (const item of recent) {
			const row = box.createDiv({ cls: "prompt-craft-home-recent" });
			const main = row.createDiv({ cls: "prompt-craft-home-recent-main" });
			const link = main.createEl("a", { text: item.title });
			link.addEventListener("click", (event) => {
				event.preventDefault();
				void this.plugin.activateItem(item.path, "open");
			});
			const meta = main.createDiv({ cls: "prompt-craft-result-meta" });
			if (item.dominio) {
				meta.createSpan({ text: item.dominio, cls: `prompt-craft-chip prompt-craft-hue-${hueIndex(item.dominio, DOMAIN_HUES)}` });
			}
			if (item.estado) {
				const state = meta.createSpan({ cls: "prompt-craft-state" });
				state.setAttribute("data-estado", item.estado);
				state.createSpan({ cls: "prompt-craft-dot" });
				state.appendText(labelFor("estado", item.estado));
			}
			meta.createSpan({ text: `v${item.version}`, cls: "prompt-craft-muted" });

			const actions = row.createDiv({ cls: "prompt-craft-home-recent-actions" });
			const act = (icon: string, label: string, action: () => void) => {
				const b = actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": label } });
				setIcon(b, icon);
				b.addEventListener("click", action);
			};
			act("wand-sparkles", t("search.use"), () => void this.plugin.activateItem(item.path, "use"));
			act("rotate-cw", t("cmd.recordIteration"), () => {
				const file = this.app.vault.getAbstractFileByPath(item.path);
				if (file instanceof TFile) new IterationModal(this.app, this.plugin, file, () => void this.render()).open();
			});
		}
	}

	/** Bloques, bancos de ejemplos, meta-prompts y paquetes: cuántos hay y cómo crearlos o verlos. */
	private renderMaterial(root: HTMLElement, counts: { blocks: number; banks: number; metas: number; packs: number }): void {
		const box = this.section(root, t("home.material"));
		box.createEl("p", { text: t("home.material.desc"), cls: "prompt-craft-muted" });
		const paths = this.plugin.getPaths();
		const grid = box.createDiv({ cls: "prompt-craft-home-material" });
		const card = (
			title: string,
			count: number,
			desc: string,
			folder: string,
			actions: { label: string; icon: string; run: () => void }[],
		) => {
			const c = grid.createDiv({ cls: "prompt-craft-home-mcard" });
			const head = c.createDiv({ cls: "prompt-craft-home-mhead" });
			head.createSpan({ text: title, cls: "prompt-craft-home-step-title" });
			head.createSpan({ text: String(count), cls: "prompt-craft-home-mcount" });
			c.createDiv({ text: desc, cls: "prompt-craft-muted" });
			const row = c.createDiv({ cls: "prompt-craft-home-mactions" });
			for (const a of actions) {
				const b = row.createEl("button");
				setIcon(b.createSpan(), a.icon);
				b.createSpan({ text: a.label });
				b.addEventListener("click", a.run);
			}
			const view = row.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("home.material.folder") } });
			setIcon(view, "folder-open");
			view.addEventListener("click", () => this.plugin.revealFolder(folder));
		};
		card(t("home.material.blocks"), counts.blocks, t("home.material.blocks.desc"), paths.blocks, [
			{ label: t("home.material.new"), icon: "plus", run: () => new BlockFormModal(this.app, this.plugin, () => void this.render()).open() },
		]);
		card(t("home.material.examples"), counts.banks, t("home.material.examples.desc"), paths.examples, [
			{ label: t("home.material.new"), icon: "plus", run: () => new ExamplesFormModal(this.app, this.plugin, () => void this.render()).open() },
		]);
		card(t("home.material.metas"), counts.metas, t("home.material.metas.desc"), paths.metaPrompts, [
			{ label: t("home.material.new"), icon: "plus", run: () => this.plugin.openNewPromptForm(undefined, "meta-prompt") },
			{ label: t("cmd.improvePrompt"), icon: "wand", run: () => void this.plugin.improveActivePrompt() },
		]);
		card(t("home.material.packs"), counts.packs, t("home.material.packs.desc"), paths.packs, [
			{ label: t("cmd.importPack"), icon: "package-open", run: () => new ImportPackModal(this.app, this.plugin).open() },
			{ label: t("cmd.exportPack"), icon: "package", run: () => new ExportPackModal(this.app, this.plugin).open() },
		]);
	}

	private async renderAlerts(root: HTMLElement, items: Awaited<ReturnType<typeof loadSearchItems>>, results: Awaited<ReturnType<typeof validateLibrary>>): Promise<void> {
		const box = this.section(root, t("home.next"));
		const alerts = homeAlerts(items, results, Date.now());
		if (alerts.length === 0) {
			box.createEl("p", { text: items.length ? t("home.next.none") : t("home.next.empty"), cls: "prompt-craft-muted" });
			return;
		}
		for (const alert of alerts) {
			const item = box.createDiv({ cls: `prompt-craft-warning ${alert.kind === "invalid" ? "is-sensitive" : "is-personal"}` });
			item.createEl("p", { text: t(ALERT_KEYS[alert.kind], { count: alert.count }) });
			const list = item.createEl("ul");
			for (const note of alert.notes) {
				const link = list.createEl("li").createEl("a", { text: note.title });
				link.addEventListener("click", (event) => {
					event.preventDefault();
					const file = this.app.vault.getAbstractFileByPath(note.path);
					if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file);
				});
			}
			if (alert.count > alert.notes.length) {
				item.createEl("p", { text: t("home.alert.more", { count: alert.count - alert.notes.length }), cls: "prompt-craft-muted" });
			}
		}
	}

	private renderQuick(root: HTMLElement): void {
		const box = this.section(root, t("home.quick"));
		const grid = box.createDiv({ cls: "prompt-craft-home-quick" });
		const add = (label: string, icon: string, action: () => void) => {
			const button = grid.createEl("button");
			setIcon(button.createSpan(), icon);
			button.createSpan({ text: label });
			button.addEventListener("click", action);
		};
		add(t("cmd.newPrompt"), "file-plus", () => this.plugin.openNewPromptForm());
		add(t("cmd.searchLibrary"), "search", () => new SearchModal(this.app, this.plugin).open());
		add(t("cmd.usePrompt"), "wand-sparkles", () => new SearchModal(this.app, this.plugin, "use").open());
		add(t("cmd.showTable"), "table", () => void this.plugin.activateTable());
		add(t("cmd.improvePrompt"), "wand", () => void this.plugin.improveActivePrompt());
		add(t("cmd.recordIteration"), "rotate-cw", () => this.plugin.recordIterationForActiveNote());
		add(t("cmd.importPack"), "package-open", () => new ImportPackModal(this.app, this.plugin).open());
		add(t("cmd.exportPack"), "package", () => new ExportPackModal(this.app, this.plugin).open());
	}

	private renderHelp(root: HTMLElement): void {
		const box = this.section(root, t("home.help"));
		box.createEl("h3", { text: t("home.help.method") });
		box.createEl("p", { text: t("home.help.method.desc") });
		const list = box.createEl("ul");
		for (const key of ELEMENTOS) {
			const li = list.createEl("li");
			li.createEl("strong", { text: labelFor("elemento", key) });
			li.appendText(`: ${t(`form.el.${key}`)}`);
		}
		box.createEl("h3", { text: t("home.help.cycle") });
		box.createEl("p", { text: t("home.help.cycle.desc") });
		box.createEl("h3", { text: t("home.help.folders") });
		box.createEl("p", { text: t("home.help.folders.desc") });
		const paths = this.plugin.getPaths();
		const folders = box.createEl("ul");
		const line = (label: string, path: string) => {
			const li = folders.createEl("li");
			li.createEl("code", { text: path });
			li.appendText(` ${label}`);
		};
		line(t("home.help.folder.prompts"), paths.prompts);
		line(t("home.help.folder.blocks"), paths.blocks);
		line(t("home.help.folder.examples"), paths.examples);
		line(t("home.help.folder.meta"), paths.metaPrompts);
		line(t("home.help.folder.logs"), paths.logs);
		line(t("home.help.folder.packs"), paths.packs);
		box.createEl("p", { text: t("home.help.own"), cls: "prompt-craft-muted" });
	}
}
