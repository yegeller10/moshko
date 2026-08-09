import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  CalendarDays,
  Clock3,
  Car,
  Users,
  Building2,
  FileBarChart2,
  Upload,
  Settings,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  key: string;
  end?: boolean;
};

const primaryMobile: NavItem[] = [
  { to: "/", icon: LayoutDashboard, key: "dashboard", end: true },
  { to: "/calendar", icon: CalendarDays, key: "calendar" },
  { to: "/expenses", icon: Car, key: "expenses" },
  { to: "/reports", icon: FileBarChart2, key: "reports" },
];

const moreMobile: NavItem[] = [
  { to: "/entries", icon: Clock3, key: "entries" },
  { to: "/workers", icon: Users, key: "workers" },
  { to: "/clients", icon: Building2, key: "clients" },
  { to: "/import", icon: Upload, key: "import" },
  { to: "/settings", icon: Settings, key: "settings" },
];

const allLinks: NavItem[] = [...primaryMobile, ...moreMobile];

function BrandMark({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex items-center gap-3", compact && "gap-2")}>
      <img
        src="/logo.png"
        alt=""
        className={cn("object-contain", compact ? "h-8 w-8" : "h-11 w-11")}
      />
      <div>
        <h1
          className={cn(
            "font-bold tracking-tight text-ink",
            compact ? "text-base" : "text-xl",
          )}
        >
          {t("appName")}
        </h1>
        {!compact && <p className="text-xs text-brand">{t("tagline")}</p>}
      </div>
    </div>
  );
}

function linkClass(isActive: boolean, desktop = false) {
  if (desktop) {
    return cn(
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
      isActive
        ? "bg-brand-soft text-brand-dark"
        : "text-muted hover:bg-zinc-100 hover:text-ink",
    );
  }
  return cn(
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[10px] font-medium",
    isActive ? "text-brand-dark" : "text-muted",
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const isCalendar = location.pathname.startsWith("/calendar");

  const moreActive = moreMobile.some(
    (l) =>
      location.pathname === l.to || location.pathname.startsWith(`${l.to}/`),
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [moreOpen]);

  return (
    <div className="flex h-dvh w-full overflow-hidden" dir="ltr">
      <div className="flex h-dvh w-full min-w-0 overflow-hidden" dir="rtl">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-e border-border bg-white px-3 py-4 lg:w-64 md:flex">
          <div className="mb-6 px-2">
            <BrandMark />
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {allLinks.map(({ to, icon: Icon, key, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => linkClass(isActive, true)}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{t(`nav.${key}`)}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col pb-14 md:pb-0",
            isCalendar && "overflow-hidden",
          )}
        >
          {!isCalendar && (
            <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-white px-4 py-2.5 md:px-6 md:py-3">
              <div className="flex items-center justify-between gap-3 md:hidden">
                <BrandMark compact />
              </div>
              <div className="hidden md:block">
                <p className="text-sm text-muted">{t("tagline")}</p>
              </div>
            </header>
          )}

          <main
            className={cn(
              "min-h-0 w-full flex-1",
              isCalendar
                ? "overflow-hidden p-0"
                : "overflow-y-auto px-4 py-4 md:px-6 md:py-6 lg:px-8",
            )}
          >
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white md:hidden">
        <div className="flex h-14 items-stretch px-1">
          {primaryMobile.map(({ to, icon: Icon, key, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => linkClass(isActive)}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate leading-tight">
                {t(`nav.${key}`)}
              </span>
            </NavLink>
          ))}

          <div className="relative flex min-w-0 flex-1" ref={moreRef}>
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-label={t("nav.more")}
              onClick={() => setMoreOpen((v) => !v)}
              className={linkClass(moreActive || moreOpen)}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="leading-tight">{t("nav.more")}</span>
            </button>

            {moreOpen && (
              <div className="absolute bottom-[calc(100%+0.5rem)] end-1 z-40 w-52 overflow-hidden rounded-2xl border border-border bg-white shadow-lg">
                {moreMobile.map(({ to, icon: Icon, key, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-3 text-sm font-medium",
                        isActive
                          ? "bg-brand-soft text-brand-dark"
                          : "text-ink hover:bg-zinc-50",
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {t(`nav.${key}`)}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}
