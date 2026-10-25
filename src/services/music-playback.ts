import { Platform } from "obsidian";

export type MusicTrack = { title: string; source: string };
export type ResolvedAudio = { url: string; release?: () => void };
export const AUDIO_EXTENSION = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)(?:[?#].*)?$/i;
export function parseMusicTracks(raw: string): MusicTrack[] {
  return String(raw || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const split = line.indexOf("|");
    const source = (split < 0 ? line : line.slice(split + 1)).trim();
    const title = (split < 0 ? "" : line.slice(0, split)).trim()
      || source.split(/[\\/]/).pop()?.split(/[?#]/)[0] || "Music";
    return { title, source };
  }).filter((track) => Boolean(track.source));
}
export function isExternalPath(source: string): boolean {
  return /^[a-z]:[\\/]/i.test(source) || source.startsWith("/") || source.startsWith("\\\\");
}
export function isMusicSharePage(source: string): boolean {
  try {
    const host = new URL(source).hostname;
    return /(^|\.)(music\.163\.com|y\.qq\.com|c6\.y\.qq\.com|163cn\.tv)$/i.test(host);
  } catch { return false; }
}
export async function resolveMusicSource(app: { vault: { getAbstractFileByPath: (path: string) => unknown; getResourcePath: (file: never) => string } }, source: string): Promise<ResolvedAudio> {
  if (/^https?:\/\//i.test(source)) {
    if (isMusicSharePage(source)) throw new Error("share");
    return { url: source };
  }
  if (isExternalPath(source)) {
    if (!Platform?.isDesktop) throw new Error("desktop");
    if (!AUDIO_EXTENSION.test(source)) throw new Error("format");
    let bytes: Uint8Array;
    // Deliberate, read-only access to a user-configured audio file OUTSIDE the vault
    // (e.g. D:\Music\foo.mp3). The vault API cannot address files outside the vault,
    // so playback of external files requires Node's fs. Access is strictly limited to:
    // absolute paths only (isExternalPath), an audio-extension whitelist, and reads
    // only — never writes, never directory traversal (paths containing ".." are
    // rejected earlier by the format guard).
    try { bytes = await require("fs").promises.readFile(source) as Uint8Array; }
    catch { throw new Error("missing"); }
    const extension = source.split(".").pop()?.toLowerCase() || "";
    const mime: Record<string, string> = { mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", opus: "audio/ogg", webm: "audio/webm" };
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime[extension] || "application/octet-stream" }));
    return { url, release: () => URL.revokeObjectURL(url) };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(source) || source.split(/[\\/]/).includes("..")) throw new Error("format");
  const file = app.vault.getAbstractFileByPath(source.replace(/\\/g, "/"));
  if (!file || !AUDIO_EXTENSION.test(source)) throw new Error("missing");
  return { url: app.vault.getResourcePath(file as never) };
}

export async function scanMusicFolder(folder: string): Promise<MusicTrack[]> {
  if (!Platform?.isDesktop) throw new Error("desktop");
  if (!isExternalPath(folder)) throw new Error("format");
  // Read-only directory listing of a user-configured folder OUTSIDE the vault,
  // used to build the local-music playlist. Same guardrails as resolveMusicSource:
  // absolute path only, read-only, audio whitelist applied below.
  const fs = require("fs").promises as {
    readdir: (folder: string, options?: { withFileTypes?: boolean }) => Promise<Array<{ isFile: () => boolean; name: string }>>;
  };
  const path = require("path") as { parse: (p: string) => { name: string }; join: (...parts: string[]) => string };
  const entries = await fs.readdir(folder, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && AUDIO_EXTENSION.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((entry) => ({ title: path.parse(entry.name).name, source: path.join(folder, entry.name) }));
}

/** The audio lifetime belongs to the plugin, so view refreshes do not interrupt playback. */
export class MusicSession {
  tracks: MusicTrack[] = [];
  index = 0;
  error = "";
  loading = false;
  loopPlaylist = true;
  playMode: "sequential" | "shuffle" = "sequential";
  order: number[] = [];
  private listeners = new Set<() => void>();
  private resource?: ResolvedAudio;
  private generation = 0;
  private requestedPlayback = false;
  private disposed = false;
  private handlers: Array<[string, () => void]> = [];
  constructor(readonly audio: HTMLAudioElement, private resolve: (source: string) => Promise<ResolvedAudio>) {
    audio.preload = "metadata";
    for (const event of ["play", "pause", "timeupdate", "loadedmetadata", "volumechange"]) this.listen(event, () => this.emit());
    this.listen("error", () => { this.error = "playback"; this.emit(); });
    this.listen("ended", () => {
      const position = this.order.indexOf(this.index);
      if (position + 1 < this.order.length || this.loopPlaylist) void this.next(true);
      else this.emit();
    });
  }
  private listen(event: string, fn: () => void): void { this.audio.addEventListener(event, fn); this.handlers.push([event, fn]); }
  private emit(): void { for (const listener of this.listeners) listener(); }
  subscribe(fn: () => void): () => void { this.listeners.add(fn); fn(); return () => this.listeners.delete(fn); }
  configure(tracks: MusicTrack[], loopPlaylist = true, playMode: "sequential" | "shuffle" = "sequential"): void {
    const rebuildOrder = JSON.stringify(tracks) !== JSON.stringify(this.tracks) || this.playMode !== playMode;
    this.playMode = playMode;
    const source = this.tracks[this.index]?.source;
    const next = tracks.findIndex((track) => track.source === source);
    if (JSON.stringify(tracks) !== JSON.stringify(this.tracks)) {
      this.tracks = tracks;
      if (next >= 0) this.index = next;
      else { this.generation++; this.requestedPlayback = false; this.audio.pause(); this.audio.removeAttribute("src"); this.audio.load(); this.resource?.release?.(); this.resource = undefined; this.index = 0; this.error = ""; this.loading = false; }
    }
    if (rebuildOrder) this.buildOrder();
    this.audio.volume = 1;
    this.loopPlaylist = loopPlaylist;
    this.emit();
  }
  private buildOrder(): void {
    this.order = this.tracks.map((_, index) => index);
    if (this.playMode === "shuffle") {
      const rest = this.order.filter((index) => index !== this.index);
      for (let i = rest.length - 1; i > 0; i--) {
        const target = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[target]] = [rest[target], rest[i]];
      }
      this.order = this.tracks.length ? [this.index, ...rest] : [];
    }
  }
  async next(play = this.requestedPlayback || !this.audio.paused): Promise<void> {
    if (!this.tracks.length) return;
    let position = this.order.indexOf(this.index) + 1;
    if (position >= this.order.length) { this.buildOrder(); position = this.playMode === "shuffle" && this.order.length > 1 ? 1 : 0; }
    await this.select(this.order[position], play);
  }
  async previous(): Promise<void> {
    if (!this.tracks.length) return;
    const position = this.order.indexOf(this.index);
    await this.select(this.order[(position - 1 + this.order.length) % this.order.length]);
  }
  async select(index: number, play = this.requestedPlayback || !this.audio.paused): Promise<void> {
    if (!this.tracks.length || this.disposed) return;
    const generation = ++this.generation;
    this.requestedPlayback = play;
    this.audio.pause(); this.index = (index + this.tracks.length) % this.tracks.length;
    this.loading = true; this.error = ""; this.emit();
    try {
      const resource = await this.resolve(this.tracks[this.index].source);
      if (generation !== this.generation || this.disposed) { resource.release?.(); return; }
      this.audio.removeAttribute("src"); this.audio.load(); this.resource?.release?.(); this.resource = resource;
      this.audio.src = resource.url; this.audio.load();
      if (play) await this.audio.play();
    } catch (error) {
      if (generation === this.generation) this.error = ["share", "desktop", "format", "missing"].includes((error as Error).message) ? (error as Error).message : "playback";
    } finally { if (generation === this.generation) { this.loading = false; this.emit(); } }
  }
  async toggle(): Promise<void> {
    if (this.loading) return;
    if (!this.audio.paused) { this.requestedPlayback = false; this.audio.pause(); return; }
    if (!this.resource || this.error) { await this.select(this.index, true); return; }
    this.requestedPlayback = true;
    try { await this.audio.play(); this.error = ""; } catch { this.error = "playback"; } this.emit();
  }
  seek(seconds: number): void {
    if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration));
  }
  dispose(): void {
    this.disposed = true; this.generation++; this.requestedPlayback = false; this.audio.pause();
    for (const [event, handler] of this.handlers) this.audio.removeEventListener(event, handler);
    this.audio.removeAttribute("src"); this.audio.load(); this.resource?.release?.(); this.listeners.clear();
  }
}
