import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { loadContent } from "./content/load";
import { OtherTabError, bootPersistence } from "./store/persistence";
import { removeNetlifyBadge } from "./lib/remove-netlify-badge";
import "./index.css";

removeNetlifyBadge();

const root = createRoot(document.getElementById("root")!);

function show(node: ReactNode) {
  root.render(
    <StrictMode>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        storageKey="launchpad:theme"
        disableTransitionOnChange
      >
        {node}
      </ThemeProvider>
    </StrictMode>,
  );
}

/** Shown when the database cannot be opened by this tab. */
function StoragePending({ otherTab, message }: { otherTab: boolean; message: string }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">
        {otherTab ? "Launchpad is open in another tab" : "Launchpad could not start"}
      </h1>
      <p className="text-muted-foreground">
        {otherTab
          ? "Your progress is stored in a local database that only one tab can use at a time. Close the other Launchpad tab or window, then try again."
          : message}
      </p>
      <button
        type="button"
        onClick={() => location.reload()}
        className="h-10 cursor-pointer rounded-lg bg-primary px-4 font-medium text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}

// The browser database must be open and the course library read from it before the first render.
// The app is imported afterwards so its modules see the loaded content.
bootPersistence()
  .then(loadContent)
  .then(() => import("./App"))
  .then(({ App }) =>
    show(
      // HashRouter keeps the app deployable on any static host or a plain file share.
      <HashRouter>
        <App />
      </HashRouter>,
    ),
  )
  .catch((e: unknown) =>
    show(
      <StoragePending
        otherTab={e instanceof OtherTabError}
        message={e instanceof Error ? e.message : String(e)}
      />,
    ),
  );
