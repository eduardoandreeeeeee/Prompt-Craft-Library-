import { App, Modal, Notice, Setting, TFile } from "obsidian";
import {
	ADJUST_TARGETS,
	AdjustTarget,
	DIAGNOSTIC_IDS,
	DiagnosticId,
	adjustLabel,
	fixText,
	shouldSuggestReference,
	symptomText,
	targetsFor,
} from "../core/diagnostics";
import { OUTCOMES, Outcome } from "../core/iteration";
import { ESTADOS, Estado } from "../core/vocab";
import { baseName } from "../core/library";
import { labelFor, t } from "../i18n";
import type PromptCraftPlugin from "../main";
import { IterationContext, readIterationContext, recordIteration } from "../services/logs";

const today = (): string => {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Registra una iteración del ciclo de refinamiento: qué se vio, qué elemento se ajustó (uno
 * por iteración), cómo quedó y el prompt resultante. Todo queda en la bitácora del prompt.
 */
export class IterationModal extends Modal {
	private ctx!: IterationContext;
	private readonly symptoms = new Set<DiagnosticId>();
	private target: AdjustTarget = "contexto";
	private targetTouched = false;
	private outcome: Outcome = "mejoro";
	private note = "";
	private newPrompt = "";
	private estado: Estado = "en-iteracion";

	private suggestionsEl!: HTMLElement;
	private targetSelect: HTMLSelectElement | null = null;
	private stopEl!: HTMLElement;

	constructor(
		app: App,
		private readonly plugin: PromptCraftPlugin,
		private readonly file: TFile,
		private readonly onDone?: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		void this.init();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async init(): Promise<void> {
		this.ctx = await readIterationContext(this.app, this.file);
		this.newPrompt = this.ctx.prompt;
		this.estado = (ESTADOS as readonly string[]).includes(this.ctx.estado)
			? (this.ctx.estado as Estado)
			: "en-iteracion";
		if (this.estado === "borrador") this.estado = "en-iteracion";
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("prompt-craft-iteration");
		this.titleEl.setText(t("iter.title", { title: baseName(this.file.path) }));

		contentEl.createEl("p", {
			text: t("iter.info", { version: this.ctx.version, count: this.ctx.iteraciones }),
			cls: "prompt-craft-muted",
		});

		contentEl.createEl("h3", { text: t("iter.symptoms"), cls: "prompt-craft-wizard-heading" });
		contentEl.createEl("p", { text: t("iter.symptoms.desc"), cls: "prompt-craft-muted" });
		const grid = contentEl.createDiv({ cls: "prompt-craft-symptoms" });
		for (const id of DIAGNOSTIC_IDS) {
			const label = grid.createEl("label", { cls: "prompt-craft-symptom" });
			const input = label.createEl("input", { type: "checkbox" });
			input.checked = this.symptoms.has(id);
			input.addEventListener("change", () => {
				if (input.checked) this.symptoms.add(id);
				else this.symptoms.delete(id);
				this.onSymptomsChanged();
			});
			const text = label.createSpan();
			text.createSpan({ text: id, cls: "prompt-craft-symptom-id" });
			text.appendText(` ${symptomText(id)}`);
		}
		this.suggestionsEl = contentEl.createDiv({ cls: "prompt-craft-suggestions" });
		this.renderSuggestions();

		new Setting(contentEl)
			.setName(t("iter.target"))
			.setDesc(t("iter.target.desc"))
			.addDropdown((dd) => {
				for (const target of ADJUST_TARGETS) dd.addOption(target, adjustLabel(target));
				dd.setValue(this.target).onChange((v) => {
					this.target = v as AdjustTarget;
					this.targetTouched = true;
				});
				this.targetSelect = dd.selectEl;
			});

		this.textArea(t("iter.prompt"), t("iter.prompt.desc"), this.newPrompt, 8, (v) => (this.newPrompt = v));
		this.textArea(t("iter.note"), t("iter.note.desc"), this.note, 2, (v) => (this.note = v));

		new Setting(contentEl).setName(t("iter.outcome")).addDropdown((dd) => {
			for (const o of OUTCOMES) dd.addOption(o, t(`outcome.${o}`));
			dd.setValue(this.outcome).onChange((v) => {
				this.outcome = v as Outcome;
				this.updateStop();
			});
		});

		new Setting(contentEl).setName(t("field.estado")).addDropdown((dd) => {
			for (const e of ESTADOS) dd.addOption(e, labelFor("estado", e));
			dd.setValue(this.estado).onChange((v) => (this.estado = v as Estado));
		});

		this.stopEl = contentEl.createDiv({ cls: "prompt-craft-warning is-personal" });
		this.updateStop();

		new Setting(contentEl)
			.addButton((b) => b.setButtonText(t("form.cancel")).onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(t("iter.save"))
					.setCta()
					.onClick(() => void this.save()),
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

	private onSymptomsChanged(): void {
		this.renderSuggestions();
		// Sugiere el elemento a ajustar mientras la persona no haya elegido uno.
		if (!this.targetTouched) {
			const first = targetsFor([...this.symptoms])[0];
			if (first) {
				this.target = first;
				if (this.targetSelect) this.targetSelect.value = first;
			}
		}
	}

	private renderSuggestions(): void {
		this.suggestionsEl.empty();
		if (this.symptoms.size === 0) return;
		this.suggestionsEl.createEl("p", { text: t("iter.suggestions"), cls: "prompt-craft-suggestions-title" });
		const list = this.suggestionsEl.createEl("ul");
		for (const id of DIAGNOSTIC_IDS) {
			if (!this.symptoms.has(id)) continue;
			const [target] = targetsFor([id]);
			list.createEl("li", { text: `${adjustLabel(target)}: ${fixText(id)}` });
		}
		if (this.symptoms.size > 1) {
			this.suggestionsEl.createEl("p", { text: t("iter.oneAtATime"), cls: "prompt-craft-muted" });
		}
	}

	/** Racha de iteraciones sin mejora que quedaría al guardar. */
	private prospectiveStreak(): number {
		return this.outcome === "mejoro" ? 0 : this.ctx.sinMejora + 1;
	}

	private updateStop(): void {
		const streak = this.prospectiveStreak();
		this.stopEl.empty();
		this.stopEl.toggle(shouldSuggestReference(streak));
		if (shouldSuggestReference(streak)) this.stopEl.createEl("p", { text: t("iter.stop", { count: streak }) });
	}

	private async save(): Promise<void> {
		if (this.symptoms.size === 0 && this.note.trim() === "") {
			new Notice(t("iter.needsSomething"));
			return;
		}
		try {
			const result = await recordIteration(this.app, this.plugin.getPaths(), this.file, {
				symptoms: [...this.symptoms],
				target: this.target,
				note: this.note,
				outcome: this.outcome,
				newPrompt: this.newPrompt,
				estado: this.estado,
				date: today(),
			});
			new Notice(t("iter.saved", { title: baseName(this.file.path) }));
			if (shouldSuggestReference(result.sinMejora)) new Notice(t("iter.stop", { count: result.sinMejora }), 10000);
			this.onDone?.();
			this.close();
		} catch (error) {
			console.error("[prompt-craft-library] no se pudo registrar la iteración", error);
			new Notice(t("iter.error"));
		}
	}
}
