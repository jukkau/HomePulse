export type IndexedTask = { line: number; source: string; checked: boolean; text: string; occurrences?: number; originalContent?: string };

/** Line-based parsing keeps source positions stable and excludes fenced examples. */
export function parseTasks(content: string): IndexedTask[] {
  const tasks: IndexedTask[] = [];
  let fence: { marker: string; length: number } | undefined;
  content.split(/\r?\n/).forEach((source, index) => {
    const delimiter = /^[ \t]*(`{3,}|~{3,})(.*)$/.exec(source);
    if (fence) {
      if (delimiter && delimiter[1][0] === fence.marker && delimiter[1].length >= fence.length && !delimiter[2].trim()) fence = undefined;
      return;
    }
    if (delimiter) { fence = { marker: delimiter[1][0], length: delimiter[1].length }; return; }
    const match = /^[ \t]*[-*+]\s+\[([ xX])\][ \t]+(.+)$/.exec(source);
    if (match) tasks.push({ line: index + 1, source, checked: match[1] !== " ", text: match[2] });
  });
  const counts = new Map<string, number>();
  for (const task of tasks) if (!task.checked) counts.set(task.source, (counts.get(task.source) || 0) + 1);
  for (const task of tasks) {
    task.occurrences = counts.get(task.source) || 0;
    if (task.occurrences > 1) task.originalContent = content;
  }
  return tasks;
}

export class TaskContentIndex {
  private activeReads = 0;
  private waiters: Array<() => void> = [];
  private async readLimited(read: () => Promise<string>): Promise<string> {
    if (this.activeReads >= 8) await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.activeReads += 1;
    try { return await read(); }
    finally { this.activeReads -= 1; this.waiters.shift()?.(); }
  }
  private entries = new Map<string, { key: string; tasks: Promise<IndexedTask[]> }>();
  invalidate(path: string): void { this.entries.delete(path); }
  prune(paths: Set<string>): void {
    for (const path of this.entries.keys()) if (!paths.has(path)) this.entries.delete(path);
  }
  read(file: { path: string; stat: { mtime: number; size: number } }, read: () => Promise<string>): Promise<IndexedTask[]> {
    const key = `${file.stat.mtime}:${file.stat.size}`;
    const existing = this.entries.get(file.path);
    if (existing?.key === key) return existing.tasks;
    const tasks = this.readLimited(read).then(parseTasks).catch((error: unknown) => {
      if (this.entries.get(file.path)?.tasks === tasks) this.entries.delete(file.path);
      throw error;
    });
    this.entries.set(file.path, { key, tasks });
    return tasks;
  }
}
