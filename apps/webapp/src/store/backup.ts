import { actions, getState, type State } from "./store";

interface Backup {
  app: "launchpad";
  version: 1;
  exported: string;
  state: State;
}

/** Progress, notes, bookmarks and flashcard history as one JSON file. Attachments live in your folder, not here. */
export function buildBackup(): Blob {
  const payload: Backup = {
    app: "launchpad",
    version: 1,
    exported: new Date().toISOString(),
    state: getState(),
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

type SaveHandle = {
  createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>;
};
type WindowFS = Window & { showSaveFilePicker?: (o: unknown) => Promise<SaveHandle> };

/** Uses the File System Access API where available, else a normal download. */
export async function saveBackup() {
  const blob = buildBackup();
  const name = `launchpad-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const w = window as WindowFS;
  if (w.showSaveFilePicker) {
    try {
      const h = await w.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: "Launchpad backup", accept: { "application/json": [".json"] } }],
      });
      const ws = await h.createWritable();
      await ws.write(blob);
      await ws.close();
      return "picker" as const;
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled" as const;
    }
  }
  download(blob, name);
  return "download" as const;
}

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function restoreBackup(file: File) {
  const parsed = JSON.parse(await file.text()) as Backup;
  if (parsed.app !== "launchpad" || !parsed.state) throw new Error("Not a Launchpad backup file.");
  actions.replaceAll(parsed.state);
}
