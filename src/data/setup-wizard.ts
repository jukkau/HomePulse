import { Modal, Setting, Notice } from "obsidian";
const { normalizePath } = require("obsidian");

/**
 * Steps: 1. Homepage name, 2. Projects folder, 3. Areas folder,
 *        4. Optional checkboxes: Tasks, Projects, Habits, Tech Tree
 * On completion the wizard sets data.initialized = true and persists.
 */
export class SetupWizardModal extends Modal {

  plugin: LooseValue;
  step: number = 1;
  totalSteps: number = 4;
  config: Record<string, LooseValue> = {
    language: "en",
    profileName: "My Homepage",
    projectsPath: "",
    areasPath: "",
    enableTasks: true,
    enableProjects: true,
    enableHabits: true,
    enableTechTree: true
  };

  constructor(app: LooseValue, plugin: LooseValue) {
    super(app);
    this.plugin = plugin;
    this.config.language = plugin.language;
    this.config.profileName = plugin.t("myHomepage");
  }

  onOpen(): void {
    this.modalEl.addClass("yh-setup-wizard");
    this.renderStep();
  }

  renderStep(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-setup-modal");
    contentEl.createDiv({ cls: "yh-setup-indicator" })
      .createSpan({ text: this.plugin.t("setupStep", { step: this.step, total: this.totalSteps }) });
    const steps: Record<number, (c: HTMLElement) => void> = {
      1: this.renderStep1, 2: this.renderStep2,
      3: this.renderStep3, 4: this.renderStep4
    };
    steps[this.step]?.call(this, contentEl);
  }

  renderStep1(container: HTMLElement): void {
    container.createEl("h2", { text: this.plugin.t("setupWelcome") });
    container.createDiv({ cls: "yh-setup-desc",
      text: this.plugin.t("setupWelcomeDesc") });
    new Setting(container).setName(this.plugin.t("language"))
      .setDesc(this.plugin.t("languageDesc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("en", this.plugin.t("english"));
        dropdown.addOption("zh-CN", this.plugin.t("simplifiedChinese"));
        dropdown.setValue(this.config.language);
        dropdown.onChange(async (value) => {
          const hadDefaultName = this.config.profileName === "My Homepage" || this.config.profileName === "我的首页";
          this.config.language = value;
          this.plugin.data.settings.language = value;
          await this.plugin.persist();
          this.plugin.updatePersistentUiLanguage?.();
          if (hadDefaultName) this.config.profileName = this.plugin.t("myHomepage");
          this.renderStep();
        });
      });
    new Setting(container).setName(this.plugin.t("homepageName"))
      .setDesc(this.plugin.t("homepageNameDesc"))
      .addText((text) => {
        text.setValue(this.config.profileName);
        text.onChange((v) => { this.config.profileName = v.trim() || this.plugin.t("myHomepage"); });
      });
    this.renderFooter(container, false);
  }

  renderStep2(container: HTMLElement): void {
    container.createEl("h2", { text: this.plugin.t("setupProjectFolder") });
    container.createDiv({ cls: "yh-setup-desc",
      text: this.plugin.t("setupProjectFolderDesc") });
    new Setting(container).setName(this.plugin.t("projectsFolder"))
      .setDesc(this.plugin.t("vaultPathOptional"))
      .addText((text) => {
        text.setPlaceholder(this.plugin.t("projectsFolderPlaceholder"));
        text.setValue(this.config.projectsPath);
        text.onChange((v) => { this.config.projectsPath = v.trim(); });
      });
    this.renderFooter(container, false);
  }

  renderStep3(container: HTMLElement): void {
    container.createEl("h2", { text: this.plugin.t("setupAreaFolder") });
    container.createDiv({ cls: "yh-setup-desc",
      text: this.plugin.t("setupAreaFolderDesc") });
    new Setting(container).setName(this.plugin.t("areasFolder"))
      .setDesc(this.plugin.t("vaultPathTechTreeOptional"))
      .addText((text) => {
        text.setPlaceholder(this.plugin.t("areasFolderPlaceholder"));
        text.setValue(this.config.areasPath);
        text.onChange((v) => { this.config.areasPath = v.trim(); });
      });
    this.renderFooter(container, false);
  }

  renderStep4(container: HTMLElement): void {
    container.createEl("h2", { text: this.plugin.t("chooseWidgets") });
    container.createDiv({ cls: "yh-setup-desc",
      text: this.plugin.t("chooseWidgetsDesc") });
    new Setting(container).setName(this.plugin.t("widgetTasks")).setDesc(this.plugin.t("setupTasksDesc"))
      .addToggle((t) => { t.setValue(this.config.enableTasks); t.onChange((v) => { this.config.enableTasks = v; }); });
    new Setting(container).setName(this.plugin.t("widgetProjects")).setDesc(this.plugin.t("setupProjectsDesc"))
      .addToggle((t) => { t.setValue(this.config.enableProjects); t.onChange((v) => { this.config.enableProjects = v; }); });
    new Setting(container).setName(this.plugin.t("widgetHabits")).setDesc(this.plugin.t("setupHabitsDesc"))
      .addToggle((t) => { t.setValue(this.config.enableHabits); t.onChange((v) => { this.config.enableHabits = v; }); });
    new Setting(container).setName(this.plugin.t("widgetTechTree")).setDesc(this.plugin.t("setupTechTreeDesc"))
      .addToggle((t) => { t.setValue(this.config.enableTechTree); t.onChange((v) => { this.config.enableTechTree = v; }); });
    this.renderFooter(container, true);
  }

  renderFooter(container: HTMLElement, isLast: boolean): void {
    const footer = container.createDiv({ cls: "yh-modal-footer" });
    if (this.step > 1) {
      const backBtn = footer.createEl("button", { cls: "yh-modal-cancel", text: this.plugin.t("back") });
      backBtn.addEventListener("click", () => { this.step -= 1; this.renderStep(); });
    }
    const primary = footer.createEl("button", {
      cls: "mod-cta yh-modal-save",
      text: this.plugin.t(isLast ? "finish" : "next")
    });
    primary.addEventListener("click", async () => {
      if (isLast) { await this.finish(); }
      else { this.step += 1; this.renderStep(); }
    });
  }

  async finish(): Promise<void> {
    const data = this.plugin.data;
    data.initialized = true;
    data.settings.language = this.config.language;
    data.settings.profileName = this.config.profileName;

    const projectsPath = normalizePath(this.config.projectsPath || "");
    if (projectsPath) {
      data.settings.techTreeActiveProjectRoot = projectsPath;
      for (const widget of data.layout.widgets) {
        if (widget.type !== "tech-tree") continue;
        const slot = data.widgets[widget.id];
        if (slot) slot.config.projectFolders = [];
      }
    }

    const areasPath = normalizePath(this.config.areasPath || "");
    if (areasPath) {
      data.settings.techTreeAreaRoot = areasPath;
      for (const widget of data.layout.widgets) {
        if (widget.type !== "tech-tree") continue;
        const slot = data.widgets[widget.id];
        if (slot) slot.config.areaRoot = "";
      }
    }

    const disabledTypes: string[] = [];
    if (!this.config.enableTasks) disabledTypes.push("tasks");
    if (!this.config.enableProjects) disabledTypes.push("projects");
    if (!this.config.enableHabits) disabledTypes.push("habits");
    if (!this.config.enableTechTree) disabledTypes.push("tech-tree");

    if (disabledTypes.length) {
      const keepIds = new Set(
        data.layout.widgets.filter((w: LooseValue) => !disabledTypes.includes(w.type)).map((w: LooseValue) => w.id)
      );
      data.layout.widgets = data.layout.widgets.filter((w: LooseValue) => keepIds.has(w.id));
      for (const id of Object.keys(data.widgets)) {
        if (!keepIds.has(id)) delete data.widgets[id];
      }
      const { packLayout } = require("../layout/pack-layout");
      data.layout.widgets = packLayout(data.layout.widgets, 5, {}, [], true);
    }

    data.settings = this.plugin.normalizeData(data).settings;
    await this.plugin.persist();
    this.plugin.refreshOpenViews();
    new Notice(this.plugin.t("setupComplete"));
    this.close();
  }
}
