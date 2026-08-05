import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { DashboardPage } from "@/pages/DashboardPage";
import { EntriesPage } from "@/pages/EntriesPage";
import { NewEntryPage } from "@/pages/NewEntryPage";
import { WorkersPage } from "@/pages/WorkersPage";
import { ClientsPage } from "@/pages/ClientsPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { ImportPage } from "@/pages/ImportPage";
import { SettingsPage } from "@/pages/SettingsPage";

export function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="entries" element={<EntriesPage />} />
            <Route path="entries/new" element={<NewEntryPage />} />
            <Route path="workers" element={<WorkersPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthGate>
    </BrowserRouter>
  );
}
