import type { Rows, Statement } from "./codec";
import type { ContentRows } from "../../content/codec";

type Reply = { id: number; ok: boolean; error?: string } & Record<string, unknown>;

/** Promise-based client for the SQLite worker. */
export class DbClient {
  private worker: Worker;
  private next = 1;
  private pending = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<Reply>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data);
      else p.reject(new Error(e.data.error ?? "Database error"));
    };
    this.worker.onerror = (e) => {
      const err = new Error(e.message || "The database worker failed to start");
      this.pending.forEach((p) => p.reject(err));
      this.pending.clear();
    };
  }

  private call(msg: Record<string, unknown>) {
    const id = this.next++;
    return new Promise<Reply>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...msg, id });
    });
  }

  init = () => this.call({ type: "init" }) as Promise<Reply & { version: number; sqlite: string }>;
  batch = (statements: Statement[]) =>
    this.call({ type: "batch", statements }).then(() => undefined);
  readAll = () => this.call({ type: "readAll" }).then((r) => r.rows as Rows);
  getMeta = (key: string) =>
    this.call({ type: "meta", key }).then((r) => (r.value as string | null) ?? null);
  setMeta = (key: string, value: string) =>
    this.call({ type: "meta", key, value }).then(() => undefined);
  exportBytes = () => this.call({ type: "export" }).then((r) => r.bytes as Uint8Array<ArrayBuffer>);
  contentRows = () => this.call({ type: "contentRows" }).then((r) => r.rows as ContentRows);
  wipe = () => this.call({ type: "wipe" }).then(() => undefined);
  /** Read every table of the shipped content database out of its raw bytes. */
  readContent = (bytes: Uint8Array, kind: "sqlite" | "sql" = "sqlite") =>
    this.call({ type: "content", bytes, kind }).then((r) => r.rows as ContentRows);
  terminate = () => this.worker.terminate();
}

let shared: DbClient | undefined;
/** One worker serves both the content database and the learner's database. */
export const dbClient = () => (shared ??= new DbClient());
