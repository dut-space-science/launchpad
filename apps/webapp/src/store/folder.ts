import { del, get, set } from "idb-keyval";
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Learning folder: attachments and notes are real files in a folder the learner picks
 * (File System Access API, Chromium browsers). Only the folder *handle* is remembered in
 * IndexedDB; no document content is stored by the browser.
 *
 * Layout on disk:  <folder>/<course>/<lesson>/notes.md  and any attached files.
 */

interface FSWritable {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}
interface FSFile {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FSWritable>;
}
interface FSDir {
  kind: "directory";
  name: string;
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<FSDir>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<FSFile>;
  removeEntry(name: string): Promise<void>;
  values(): AsyncIterable<FSFile | FSDir>;
  queryPermission(o: { mode: "readwrite" }): Promise<"granted" | "denied" | "prompt">;
  requestPermission(o: { mode: "readwrite" }): Promise<"granted" | "denied" | "prompt">;
}
type PickerWindow = Window & {
  showDirectoryPicker?: (o: { id: string; mode: "readwrite" }) => Promise<FSDir>;
};

export const folderSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;
const HANDLE_KEY = "launchpad:folder-handle";

export type Perm = "none" | "granted" | "prompt" | "denied";
interface FolderState {
  handle: FSDir | null;
  perm: Perm;
  version: number; // bumps when files change so lists refresh
}

let state: FolderState = { handle: null, perm: "none", version: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const patch = (p: Partial<FolderState>) => {
  state = { ...state, ...p };
  emit();
};

async function init() {
  if (!folderSupported) return;
  const h = await get<FSDir>(HANDLE_KEY);
  if (h) patch({ handle: h, perm: await h.queryPermission({ mode: "readwrite" }) });
}
void init();

export function useFolder() {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
  return {
    supported: folderSupported,
    name: s.handle?.name ?? "",
    perm: s.perm,
    version: s.version,
    connected: !!s.handle,
  };
}

export async function connectFolder() {
  const w = window as PickerWindow;
  if (!w.showDirectoryPicker)
    throw new Error("This browser cannot save to a folder. Use Chrome or Edge.");
  const h = await w.showDirectoryPicker({ id: "launchpad", mode: "readwrite" });
  await set(HANDLE_KEY, h);
  patch({ handle: h, perm: await h.requestPermission({ mode: "readwrite" }) });
}

/** Must run from a click: browsers re-ask for folder access in a new session. */
export async function allowFolder() {
  if (!state.handle) return;
  patch({ perm: await state.handle.requestPermission({ mode: "readwrite" }) });
}

export async function disconnectFolder() {
  await del(HANDLE_KEY);
  patch({ handle: null, perm: "none" });
}

const safe = (s: string) => s.replace(/[^\w.-]+/g, "_");

async function lessonDir(course: string, lesson: string, create: boolean) {
  if (!state.handle || state.perm !== "granted") return null;
  try {
    const c = await state.handle.getDirectoryHandle(safe(course), { create });
    return await c.getDirectoryHandle(safe(lesson), { create });
  } catch {
    return null;
  }
}

export interface Attachment {
  name: string;
  size: number;
  modified: number;
  file: () => Promise<File>;
}

export async function listAttachments(course: string, lesson: string): Promise<Attachment[]> {
  const dir = await lessonDir(course, lesson, false);
  if (!dir) return [];
  const out: Attachment[] = [];
  for await (const e of dir.values()) {
    if (e.kind !== "file" || e.name === "notes.md") continue;
    const f = await e.getFile();
    out.push({ name: e.name, size: f.size, modified: f.lastModified, file: () => e.getFile() });
  }
  return out.sort((a, b) => b.modified - a.modified);
}

export async function saveAttachments(course: string, lesson: string, files: FileList | File[]) {
  const dir = await lessonDir(course, lesson, true);
  if (!dir) throw new Error("Allow access to your learning folder first.");
  const existing = new Set<string>();
  for await (const e of dir.values()) existing.add(e.name);
  for (const f of Array.from(files)) {
    let name = safe(f.name) || "file";
    if (existing.has(name) || name === "notes.md") {
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let n = 2;
      while (existing.has(`${stem}-${n}${ext}`)) n++;
      name = `${stem}-${n}${ext}`;
    }
    const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await w.write(f);
    await w.close();
    existing.add(name);
  }
  patch({ version: state.version + 1 });
}

export async function removeAttachment(course: string, lesson: string, name: string) {
  const dir = await lessonDir(course, lesson, false);
  if (!dir) return;
  await dir.removeEntry(name);
  patch({ version: state.version + 1 });
}

/** Mirror a lesson's notes to <folder>/<course>/<lesson>/notes.md when a folder is connected. */
export async function writeNoteFile(course: string, lesson: string, text: string) {
  if (!text.trim()) {
    const dir = await lessonDir(course, lesson, false);
    try {
      await dir?.removeEntry("notes.md");
    } catch {
      /* nothing to remove */
    }
    return;
  }
  const dir = await lessonDir(course, lesson, true);
  if (!dir) return;
  const w = await (await dir.getFileHandle("notes.md", { create: true })).createWritable();
  await w.write(text);
  await w.close();
}

export function useAttachments(course: string, lesson: string) {
  const { perm, version } = useFolder();
  const [items, setItems] = useState<Attachment[]>([]);
  useEffect(() => {
    let live = true;
    if (perm !== "granted") {
      setItems([]);
      return;
    }
    void listAttachments(course, lesson).then((l) => live && setItems(l));
    return () => {
      live = false;
    };
  }, [course, lesson, perm, version]);
  return items;
}
