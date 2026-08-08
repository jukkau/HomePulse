// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { t } from "../i18n";

const { Setting } = require("obsidian");

function focusPlaceholder(language, value) {
  const text = String(value || "").trim();
  return !text || text === "define your focus..." || text === "写下今天要推进的事..."
    ? t(language, "defineFocus")
    : text;
}

export const focusWidget = {
  type: "focus",
  displayName: "Today's goal",
  shell: "text",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H1", w: 1, h: 1 },
  defaultConfig: { title: "today's goal", placeholder: "define your focus..." },
  defaultState: { text: "" },
  async render(container, api) {
    const text = container.createEl("div", {
      cls: "yh-focus-text",
      attr: { contenteditable: "true", spellcheck: "false", "data-placeholder": focusPlaceholder(api.language, api.widgetData.config.placeholder) }
    });
    text.setText(api.widgetData.state.text || "");
    text.addEventListener("blur", async () => {
      await api.saveState({ text: text.textContent.trim() }, false);
    });
  },
  renderSettings(container, draft, ctx) {
    new Setting(container).setName(t(ctx.language, "title")).addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName(t(ctx.language, "placeholder")).addText((text) => {
      text.setValue(focusPlaceholder(ctx.language, draft.placeholder));
      text.onChange((value) => {
        draft.placeholder = value;
      });
    });
  }
};
