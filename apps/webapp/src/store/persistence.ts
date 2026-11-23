import { useSyncExternalStore } from "react";
import { DbClient, dbClient } from "@/store/db/client";
import { diffState, stateFromRows, type Rows, type Statement } from "@/store/db/codec";
import { DATA_TABLES } from "@/store/db/schema";
import { initialState, type State } from "@/store/state";
import { hydrate, setPersister } from "@/store/store";
import { disconnectFolder } from "@/store/folder";

/**
 * Durable storage for the learner's data. SQLite (WebAssembly, in a worker, on the browser's private file system)
 * is the primary store; if the browser cannot run it, the app falls back to localStorage so nothing breaks.
 * The in-memory store stays the synchronous source of truth for the UI and writes through to SQLite in batches.
 */
const LS_KEY = "launchpad:v1";
const LS_BACKUP_KEY = "launchpad:v1.pre-sqlite";
const LOCK = "launchpad-sqlite";
/** Without SQLite, this flag records that the course library has been installed (wiping removes it). */
export const CONTENT_FLAG = "launchpad:content-installed";

export type Engine = "sqlite" | "localStorage";
export interface StorageInfo {
  engine: Engine;
  sqlite?: string; // SQLite library version
  fallbackReason?: string;
  writeError?: string;
  imported?: boolean; // data was imported from localStorage on this launch
}

export class OtherTabError extends Error {
  constructor() {
    super("Launchpad is already open in another tab.");
  }
}

let info: StorageInfo = { engine: "localStorage" };
const listeners = new Set<() => void>();
const setInfo = (p: Partial<StorageInfo>) => {
  info = { ...info, ...p };
  listeners.forEach((l) => l());
};
export const storageInfo = () => info;
export const useStorageInfo = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => info,
  );

let client: DbClient | null = null;
/** Drops writes that are queued but not yet saved, waits for the one in flight, then empties the database. */
let wiper: (() => Promise<void>) | null = null;

/** SQLite on OPFS allows one writer. Hold a Web Lock for the life of the tab so a second tab is told, not corrupted. */
async function claimTab() {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return true;
  return new Promise<boolean>((resolve) => {
    void navigator.locks.request(LOCK, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(false);
        return undefined;
      }
      resolve(true);
      return new Promise<void>(() => undefined); // never resolves: the lock is held until the tab closes
    });
  });
}

const isEmpty = (rows: Rows) => DATA_TABLES.every((t) => (rows[t] ?? []).length === 0);

function readLocalStorage(): State | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...initialState(), ...(JSON.parse(raw) as Partial<State>) } : null;
  } catch {
    return null;
  }
}

function useLocalStorageEngine(reason?: string) {
  hydrate(readLocalStorage() ?? initialState());
  setPersister((_prev, next) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* quota: keep in memory */
    }
  });
  setInfo({ engine: "localStorage", fallbackReason: reason });
}

export async function bootPersistence() {
  if (!(await claimTab())) throw new OtherTabError();

  try {
    client = dbClient();
    const ready = await client.init();
    let rows = await client.readAll();
    let state = stateFromRows(rows);
    let imported = false;

    // One-time import of data saved by earlier versions in localStorage.
    if ((await client.getMeta("imported_localstorage")) === null) {
      const legacy = readLocalStorage();
      if (legacy && isEmpty(rows)) {
        await client.batch(diffState(initialState(), legacy));
        state = legacy;
        imported = true;
        try {
          localStorage.setItem(LS_BACKUP_KEY, localStorage.getItem(LS_KEY) ?? "");
          localStorage.removeItem(LS_KEY);
        } catch {
          /* the copy is only a safety net */
        }
      }
      await client.setMeta("imported_localstorage", new Date().toISOString());
    }
    rows = {};
    hydrate(state);

    // Write-through: collect changes and send them as one transaction shortly after.
    const db = client;
    let queue: Statement[] = [];
    let timer: number | undefined;
    let chain: Promise<void> = Promise.resolve();
    const flush = () => {
      timer = undefined;
      if (!queue.length) return;
      const batch = queue;
      queue = [];
      chain = chain
        .then(() => db.batch(batch))
        .then(() => setInfo({ writeError: undefined }))
        .catch((e: Error) => {
          console.error("Saving to SQLite failed", e);
          setInfo({ writeError: e.message });
        });
    };
    wiper = async () => {
      window.clearTimeout(timer);
      timer = undefined;
      queue = [];
      await chain;
      await db.wipe();
    };
    setPersister((prev, next) => {
      queue.push(...diffState(prev, next));
      if (timer === undefined) timer = window.setTimeout(flush, 40);
    });
    window.addEventListener("pagehide", flush);
    document.addEventListener(
      "visibilitychange",
      () => document.visibilityState === "hidden" && flush(),
    );
    setInfo({ engine: "sqlite", sqlite: ready.sqlite, imported, fallbackReason: undefined });
  } catch (e) {
    client = null;
    console.warn("SQLite is unavailable, using localStorage", e);
    useLocalStorageEngine(e instanceof Error ? e.message : String(e));
  }
}

/** The whole database as a .sqlite file you can open in any SQLite tool. Null when running on the fallback engine. */
/**
 * Factory reset. Empties every table of the browser database (learner data and the installed course content) and
 * compacts the file, removes everything Launchpad keeps in localStorage (theme, study timer, older copies) and the
 * link to the learning folder, then restarts the app at first-run setup, where the course library is chosen again.
 */
export async function wipeEverything() {
  if (wiper) {
    await wiper();
    setPersister(() => undefined); // nothing may write to the database while it is being emptied
  }
  try {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("launchpad:")) localStorage.removeItem(k);
  } catch {
    /* nothing to remove */
  }
  await disconnectFolder().catch(() => undefined);
  hydrate(initialState());
  location.reload();
}

export async function exportDatabase() {
  return client ? client.exportBytes() : null;
}
