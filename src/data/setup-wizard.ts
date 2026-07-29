/* eslint-disable @typescript-eslint/no-explicit-any */

import { Modal, Setting, Notice } from "obsidian";
const { normalizePath } = require("obsidian");

/**
 * Steps: 1. Homepage name, 2. Projects folder, 3. Areas folder,
 *        4. Optional checkboxes: Tasks, Projects, Habits, Tech Tree
 * On completion the wizard sets data.initialized = true and persists.
 */
export class SetupWizardModal extends Modal {

  plugin: any;
  step: number = 1;
  totalSteps: number = 4;
  config: Record<string, any> = {
    profileName: "My Homepage",
    projectsPath: "",
    areasPath: "",
    enableTasks: true,
    enableProjects: true,
    enableHabits: true,
    enableTechTree: true
  };

  constructor(app: any, plugin: any) { super(app); this.plugin = plugin; }

  onOpen(): void {
    this.modalEl.addClass("yh-setup-wizard");
    this.renderStep();
  }

  renderStep(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-setup-modal");
    contentEl.createDiv({ cls: "yh-setup-indicator" })
      .createSpan({ text: `Step ${this.step} of ${this.totalSteps}` });
    const steps: Record<number, (c: HTMLElement) => void> = {
      1: this.renderStep1, 2: this.renderStep2,
      3: this.renderStep3, 4: this.renderStep4
    };
    steps[this.step]?.call(this, contentEl);
  }

  renderStep1(container: HTMLElement): void {
    container.createEl("h2", { text: "Welcome!" });
    container.createDiv({ cls: "yh-setup-desc",
      text: "Set up your homepage. Everything can be changed later in Settings." });
    new Setting(container).setName("Homepage name")
      .setDesc("This appears at the top of your homepage.")
      .addText((text) => {
        text.setValue(this.config.profileName);
        text.onChange((v) => { this.config.profileName = v.trim() || "My Homepage"; });
      });
    this.renderFooter(container, false);
  }

  renderStep2(container: HTMLElement): void {
    container.createEl("h2", { text: "Project folder" });
    container.createDiv({ cls: "yh-setup-desc",
      text: "Where does your vault store project notes? Examples: Projects/, 10_Projects/" });
    new Setting(container).setName("Projects folder")
      .setDesc("Vault-relative path. Leave blank to skip.")
      .addText((text) => {
        text.setPlaceholder("e.g. Projects/, 10_Projects/");
        text.setValue(this.config.projectsPath);
        text.onChange((v) => { this.config.projectsPath = v.trim(); });
      });
    this.renderFooter(container, false);
  }

  renderStep3(container: HTMLElement): void {
    container.createEl("h2", { text: "Areas folder" });
    container.createDiv({ cls: "yh-setup-desc",
      text: "Tech Tree uses notes in this folder that have value/* tags. Examples: 20_Areas, Areas/" });
    new Setting(container).setName("Areas folder")
      .setDesc("Vault-relative path. Leave blank to skip the Tech Tree.")
      .addText((text) => {
        text.setPlaceholder("e.g. 20_Areas");
        text.setValue(this.config.areasPath);
        text.onChange((v) => { this.config.areasPath = v.trim(); });
      });
    this.renderFooter(container, false);
  }

  renderStep4(container: HTMLElement): void {
    container.createEl("h2", { text: "Choose widgets" });
    container.createDiv({ cls: "yh-setup-desc",
      text: "Enable the widgets you want. You can add or remove them later." });
    new Setting(container).setName("Tasks").setDesc("Show open tasks from project notes.")
      .addToggle((t) => { t.setValue(this.config.enableTasks); t.onChange((v) => { this.config.enableTasks = v; }); });
    new Setting(container).setName("Projects").setDesc("Show recent project notes.")
      .addToggle((t) => { t.setValue(this.config.enableProjects); t.onChange((v) => { this.config.enableProjects = v; }); });
    new Setting(container).setName("Habits").setDesc("Track daily habits.")
      .addToggle((t) => { t.setValue(this.config.enableHabits); t.onChange((v) => { this.config.enableHabits = v; }); });
    new Setting(container).setName("Tech Tree").setDesc("Visual capability map: Value → Area → Project.")
      .addToggle((t) => { t.setValue(this.config.enableTechTree); t.onChange((v) => { this.config.enableTechTree = v; }); });
    this.renderFooter(container, true);
  }

  renderFooter(container: HTMLElement, isLast: boolean): void {
    const footer = container.createDiv({ cls: "yh-modal-footer" });
    if (this.step > 1) {
      const backBtn = footer.createEl("button", { cls: "yh-modal-cancel", text: "Back" });
      backBtn.addEventListener("click", () => { this.step -= 1; this.renderStep(); });
    }
    const primary = footer.createEl("button", { cls: "mod-cta yh-modal-save", text: isLast ? "Finish" : "Next" });
    primary.addEventListener("click", async () => {
      if (isLast) { await this.finish(); }
      else { this.step += 1; this.renderStep(); }
    });
  }

  async finish(): Promise<void> {
    const data = this.plugin.data;
    data.initialized = true;
    data.settings.profileName = this.config.profileName;

    const projectsPath = normalizePath(this.config.projectsPath || "");
    if (projectsPath) {
      data.settings.techTreeActiveProjectRoot = projectsPath;
      for (const widget of data.layout.widgets) {
        if (widget.type === "projects" || widget.type === "tasks") {
          const slot = data.widgets[widget.id];
          if (slot) slot.config.projectFolders = [projectsPath];
        }
      }
    }

    const areasPath = normalizePath(this.config.areasPath || "");
    if (areasPath) data.settings.techTreeAreaRoot = areasPath;

    const disabledTypes: string[] = [];
    if (!this.config.enableTasks) disabledTypes.push("tasks");
    if (!this.config.enableProjects) disabledTypes.push("projects");
    if (!this.config.enableHabits) disabledTypes.push("habits");
    if (!this.config.enableTechTree) disabledTypes.push("tech-tree");

    if (disabledTypes.length) {
      const keepIds = new Set(
        data.layout.widgets.filter((w: any) => !disabledTypes.includes(w.type)).map((w: any) => w.id)
      );
      data.layout.widgets = data.layout.widgets.filter((w: any) => keepIds.has(w.id));
      for (const id of Object.keys(data.widgets)) {
        if (!keepIds.has(id)) delete data.widgets[id];
      }
      const { packLayout } = require("../layout/pack-layout");
      data.layout.widgets = packLayout(data.layout.widgets, 5, {}, [], true);
    }

    data.settings = this.plugin.normalizeData(data).settings;
    await this.plugin.persist();
    this.plugin.refreshOpenViews();
    new Notice("Homepage setup complete!");
    this.close();
  }
}
