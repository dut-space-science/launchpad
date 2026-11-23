import { setCourses } from "@/data/courses";
import { setFields } from "@/data/taxonomy";
import { dbClient } from "@/store/db/client";
import { CONTENT_FLAG, storageInfo } from "@/store/persistence";
import { contentFromRows, installStatements, type Content } from "./codec";

/**
 * The course library is stored in the browser database, like the learner's own data. It gets there from first-run
 * setup (src/components/onboarding.tsx): either Launchpad's own library, shipped as public/content.sqlite (built from
 * db/seed/*.sql), or a file the user uploads. Until one is chosen, or after Wipe all data, the library is empty and the
 * app shows setup instead of the normal screens. Screens only read the in-memory copy built here, so this must finish
 * before the first render.
 */
const EMPTY: Content = { fields: [], courses: [] };

async function fetchShipped() {
  const res = await fetch(new URL("content.sqlite", document.baseURI), { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not download the course database (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** A short fingerprint of a file, to tell whether the installed copy is out of date. */
async function fingerprint(bytes: Uint8Array<ArrayBuffer>) {
  if (!globalThis.crypto?.subtle) return `size:${bytes.length}`;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function publish(c: Content) {
  setFields(c.fields);
  setCourses(c.courses);
}

export async function loadContent() {
  const db = dbClient();

  if (storageInfo().engine !== "sqlite") {
    // No database in this browser: the shipped library is used directly once it has been chosen.
    if (!localStorage.getItem(CONTENT_FLAG)) return publish(EMPTY);
    return publish(contentFromRows(await db.readContent(await fetchShipped())));
  }

  const source = await db.getMeta("content_source");
  if (source === null) return publish(EMPTY); // first run, or wiped: show setup

  // Launchpad's own library follows the app: refresh the installed copy when the shipped file changes.
  if (source === "default") {
    try {
      const shipped = await fetchShipped();
      const version = await fingerprint(shipped);
      if ((await db.getMeta("content_version")) !== version) {
        const rows = await db.readContent(shipped);
        await db.batch(installStatements(rows, version, "default"));
        return publish(contentFromRows(rows));
      }
    } catch {
      // Offline or the server is down: carry on with the copy already in the browser database.
    }
  }
  return publish(contentFromRows(await db.contentRows()));
}

/** Use Launchpad's own course library. Restarts so every screen sees it. */
export async function useLaunchpadCourses() {
  const bytes = await fetchShipped();
  const rows = await dbClient().readContent(bytes);
  if (storageInfo().engine === "sqlite")
    await dbClient().batch(installStatements(rows, await fingerprint(bytes), "default"));
  else localStorage.setItem(CONTENT_FLAG, "1");
  location.reload();
}

/**
 * Use a course library from the user's own file: a SQLite database or a .sql script that follows the Launchpad
 * schema (see db/README.md). Everything is checked before anything is stored. Restarts on success.
 */
export async function useOwnCourses(file: File) {
  if (storageInfo().engine !== "sqlite")
    throw new Error("Using your own courses needs SQLite, which this browser cannot run.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const rows = await dbClient().readContent(bytes, /\.sql$/i.test(file.name) ? "sql" : "sqlite");
  if (contentFromRows(rows).courses.length === 0) throw new Error("This file contains no courses");
  await dbClient().batch(installStatements(rows, await fingerprint(bytes), "custom"));
  location.reload();
}
