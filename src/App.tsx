import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { QuotesPage } from "@/pages/QuotesPage";
import { JobPage } from "@/pages/JobPage";
import { EntriesPage } from "@/pages/EntriesPage";
import { NewEntryPage } from "@/pages/NewEntryPage";
import { ExpensesPage } from "@/pages/ExpensesPage";
import { WorkersPage } from "@/pages/WorkersPage";
import { ClientsPage } from "@/pages/ClientsPage";
import { ClientDetailPage } from "@/pages/ClientDetailPage";
import { WorkerDetailPage } from "@/pages/WorkerDetailPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { ImportPage } from "@/pages/ImportPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { CitiesPage } from "@/pages/CitiesPage";

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <AuthGate>
                <AppShell />
              </AuthGate>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="quotes" element={<QuotesPage />} />
            <Route path="jobs/new" element={<JobPage />} />
            <Route path="jobs/:id" element={<JobPage />} />
            <Route path="entries" element={<EntriesPage />} />
            <Route path="entries/new" element={<NewEntryPage />} />
            <Route path="entries/add" element={<Navigate to="/quotes" replace />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="workers" element={<WorkersPage />} />
            <Route path="workers/:id" element={<WorkerDetailPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:id" element={<ClientDetailPage />} />
            <Route path="cities" element={<CitiesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
