/** Serialize immutable snapshots; one rejected write must not poison the queue. */
export class PersistenceQueue<T> {
  private tail: Promise<void> = Promise.resolve();
  committed: T;
  constructor(initial: T, private write: (data: T) => Promise<void>) {
    this.committed = structuredClone(initial);
  }
  save(data: T): Promise<void> {
    const snapshot = structuredClone(data);
    const operation = this.tail.then(async () => {
      await this.write(snapshot);
      this.committed = snapshot;
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}
