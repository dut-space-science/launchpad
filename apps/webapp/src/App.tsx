import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout";
import { Onboarding } from "@/components/onboarding";
import { courses } from "@/data/courses";
import { Home } from "@/pages/home";
import { CoursePage } from "@/pages/course";
import { Learn } from "@/pages/learn";
import { Dashboard } from "@/pages/dashboard";
import { NotFound } from "@/pages/not-found";

// Heavier / rarely-visited pages are code-split.
const Practice = lazy(() => import("@/pages/practice").then((m) => ({ default: m.Practice })));
const PracticePack = lazy(() =>
  import("@/pages/practice-pack").then((m) => ({ default: m.PracticePack })),
);
const Notebook = lazy(() => import("@/pages/notebook").then((m) => ({ default: m.Notebook })));
const Catalog = lazy(() => import("@/pages/catalog").then((m) => ({ default: m.Catalog })));
const Databank = lazy(() => import("@/pages/databank").then((m) => ({ default: m.DatabankPage })));
const Certificate = lazy(() =>
  import("@/pages/certificate").then((m) => ({ default: m.Certificate })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings").then((m) => ({ default: m.SettingsPage })),
);

export function App() {
  // No courses yet (fresh install, or after Wipe all data): first-run setup instead of the app.
  if (courses.length === 0) return <Onboarding />;
  return (
    <Suspense
      fallback={<div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>}
    >
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="courses" element={<Catalog />} />
          <Route path="practice" element={<Practice />} />
          <Route path="practice/:slug/:packId" element={<PracticePack />} />
          <Route path="courses/:slug" element={<CoursePage />} />
          <Route path="learn/:slug" element={<Learn />} />
          <Route path="learn/:slug/:lessonId" element={<Learn />} />
          <Route path="learn/:slug/quiz/:moduleId" element={<Learn />} />
          <Route path="learn/:slug/cards/:moduleId" element={<Learn />} />
          <Route path="learn/:slug/labs/:moduleId" element={<Learn />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="databank" element={<Databank />} />
          <Route path="notebook" element={<Notebook />} />
          <Route path="certificate/:slug" element={<Certificate />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
