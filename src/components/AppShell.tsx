import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Clock3,
  Users,
  Building2,
  FileBarChart2,
  Upload,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links: Array<{
  to: string;
  icon: typeof LayoutDashboard;
  key: string;
  end?: boolean;
}> = [
  { to: "/", icon: LayoutDashboard, key: "dashboard", end: true },
  { to: "/entries", icon: Clock3, key: "entries" },
  { to: "/workers", icon: Users, key: "workers" },
  { to: "/clients", icon: Building2, key: "clients" },
  { to: "/reports", icon: FileBarChart2, key: "reports" },
  { to: "/import", icon: Upload, key: "import" },
  { to: "/settings", icon: Settings, key: "settings" },
];

export function AppShell() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col pb-24">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-teal-800">
              {t("appName")}
            </h1>
            <p className="text-xs text-slate-500">{t("tagline")}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-7 gap-0.5 px-1 py-1.5">
          {links.map(({ to, icon: Icon, key, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-medium",
                  isActive ? "text-teal-800 bg-teal-50" : "text-slate-500",
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-full">{t(`nav.${key}`)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
