import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  NotebookPen,
  ScrollText,
  Compass,
  House,
  ListChecks,
  LayoutDashboard,
  Menu,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StudyWidget } from "@/components/study-widget";
import { useFocusActive } from "@/lib/focus-mode";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/courses", label: "Explore", icon: Compass },
  { to: "/practice", label: "Practice", icon: ListChecks },
  { to: "/dashboard", label: "My learning", icon: LayoutDashboard },
  { to: "/databank", label: "Databank", icon: ScrollText },
  { to: "/notebook", label: "Notebook", icon: NotebookPen },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

export function Layout() {
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setMenu(false);
  }, [pathname]);

  const immersive = pathname.startsWith("/learn/");
  const focusActive = useFocusActive();

  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col">
        {!focusActive && (
          <header className="no-print sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
            <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
              <div className="flex items-center gap-2">
                <Sheet open={menu} onOpenChange={setMenu}>
                  <SheetTrigger
                    render={
                      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu" />
                    }
                  >
                    <Menu />
                  </SheetTrigger>
                  <SheetContent side="left">
                    <SheetHeader>
                      <SheetTitle>
                        <Brand />
                      </SheetTitle>
                    </SheetHeader>
                    <nav className="grid gap-1 px-3">
                      {NAV.map((n) => (
                        <NavLink
                          key={n.to}
                          to={n.to}
                          end={n.end}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium",
                              isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                            )
                          }
                        >
                          <n.icon className="size-4" /> {n.label}
                        </NavLink>
                      ))}
                      <NavLink
                        to="/settings"
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium hover:bg-muted"
                      >
                        <Settings className="size-4" /> Settings
                      </NavLink>
                    </nav>
                  </SheetContent>
                </Sheet>
                <Link to="/" aria-label="Launchpad home" className="shrink-0">
                  <Brand />
                </Link>
              </div>
              <nav className="col-start-2 hidden items-center gap-1 lg:flex" aria-label="Primary">
                {NAV.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      cn(
                        "rounded-full px-3.5 py-1.5 font-medium whitespace-nowrap text-foreground/70 transition-colors hover:bg-muted hover:text-foreground",
                        isActive &&
                          "bg-accent font-semibold text-primary hover:bg-accent hover:text-primary",
                      )
                    }
                  >
                    {n.label}
                  </NavLink>
                ))}
              </nav>
              <div className="col-start-3 flex items-center justify-end gap-1">
                <ThemeToggle />
                <Link
                  to="/settings"
                  aria-label="Settings"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "hidden md:inline-flex",
                  )}
                >
                  <Settings />
                </Link>
              </div>
            </div>
          </header>
        )}
        <main id="main" className="flex-1">
          <Outlet />
        </main>
        {!immersive && (
          <footer className="no-print border-t bg-forest text-white/80">
            <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:grid-cols-3">
              <div className="space-y-3">
                <Brand
                  tagline
                  className="[&_span]:text-white [&_.text-muted-foreground]:text-white/60"
                />
                <p className="max-w-xs text-sm text-white/65">
                  A learning platform from the Durban University of Technology Space Science Centre.
                  It runs entirely in your browser: your progress, notes and files stay on your
                  device.
                </p>
              </div>
              <div className="text-sm">
                <div className="mb-2 font-semibold text-white">Platform</div>
                <ul className="space-y-1.5 text-white/70">
                  {NAV.map((n) => (
                    <li key={n.to}>
                      <Link className="hover:text-white" to={n.to}>
                        {n.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link className="hover:text-white" to="/settings">
                      Settings and backup
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="text-sm">
                <div className="mb-2 font-semibold text-white">About the content</div>
                <p className="text-white/65">
                  Lessons link to public sources and embed third-party YouTube videos; licensed PDFs
                  are referenced, not re-hosted. Lab models are educational and do not replace
                  project-specific analysis.
                </p>
              </div>
            </div>
            <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
              © {new Date().getFullYear()} DUT Space Science Centre
            </div>
          </footer>
        )}
      </div>
      <StudyWidget />
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  );
}
