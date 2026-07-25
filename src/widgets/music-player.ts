// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";

const { Notice, Setting, setIcon } = require("obsidian");

const DEFAULT_NETEASE_URL = "https://music.163.com/";

function safeUrl(value) {
  const url = String(value || "").trim() || DEFAULT_NETEASE_URL;
  return /^https?:\/\//i.test(url) ? url : DEFAULT_NETEASE_URL;
}

function urlHost(value) {
  try {
    return new URL(safeUrl(value)).hostname.replace(/^www\./, "");
  } catch {
    return "music.163.com";
  }
}

function openMusicUrl(value) {
  const url = safeUrl(value);
  if (!url) {
    new Notice("Music URL is empty.");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export const musicPlayerWidget = {
  type: "music-player",
  displayName: "Music Player",
  shell: "panel",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W2H1", w: 2, h: 1 },
  defaultConfig: {
    title: "music player",
    serviceName: "NetEase Cloud Music",
    loginUrl: DEFAULT_NETEASE_URL,
    playUrl: DEFAULT_NETEASE_URL
  },
  defaultState: {},
  async render(container, api) {
    const config = api.widgetData.config;
    const loginUrl = safeUrl(config.loginUrl);
    const playUrl = safeUrl(config.playUrl);
    const serviceName = config.serviceName || "NetEase Cloud Music";

    const player = container.createDiv({ cls: "yh-music" });
    const art = player.createDiv({ cls: "yh-music-art" });
    setIcon(art, "music-2");

    const body = player.createDiv({ cls: "yh-music-body" });
    body.createDiv({ cls: "yh-music-service", text: serviceName });
    body.createDiv({ cls: "yh-music-source", text: urlHost(playUrl) });

    const actions = player.createDiv({ cls: "yh-music-actions" });
    const openButton = actions.createEl("button", { cls: "yh-music-btn" });
    const openIcon = openButton.createSpan({ cls: "yh-music-btn-icon" });
    setIcon(openIcon, "log-in");
    openButton.createSpan({ text: "Open" });
    openButton.addEventListener("click", () => openMusicUrl(loginUrl));

    const playButton = actions.createEl("button", { cls: "yh-music-btn yh-music-btn-primary" });
    const playIcon = playButton.createSpan({ cls: "yh-music-btn-icon" });
    setIcon(playIcon, "play");
    playButton.createSpan({ text: "Play" });
    playButton.addEventListener("click", () => openMusicUrl(playUrl));
  },
  renderSettings(container, draft) {
    new Setting(container).setName("Title").addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName("Service name").addText((text) => {
      text.setValue(draft.serviceName || "");
      text.onChange((value) => {
        draft.serviceName = value.trim();
      });
    });
    new Setting(container).setName("Login URL").setDesc("Opened by the Open button.").addText((text) => {
      text.setPlaceholder(DEFAULT_NETEASE_URL);
      text.setValue(draft.loginUrl || "");
      text.onChange((value) => {
        draft.loginUrl = value.trim();
      });
    });
    new Setting(container).setName("Play URL").setDesc("Opened by the Play button. Use a NetEase song, album, playlist, or homepage URL.").addText((text) => {
      text.setPlaceholder(DEFAULT_NETEASE_URL);
      text.setValue(draft.playUrl || "");
      text.onChange((value) => {
        draft.playUrl = value.trim();
      });
    });
  }
};
