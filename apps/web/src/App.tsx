import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth-context';
import { AuthGuard, GuestGuard } from '@/components/route-guards';
import { AppLayout } from '@/components/app-layout';
import { LoginPage } from '@/modules/auth/pages/login-page';
import { VerifyPage } from '@/modules/auth/pages/verify-page';
import { ChatPage } from '@/modules/chat/pages/chat-page';
import { DocumentsPage } from '@/modules/documents/pages/documents-page';
import { ClientsPage } from '@/modules/clients/pages/clients-page';
import { StatsPage } from '@/modules/stats/pages/stats-page';
import { SettingsPage } from '@/modules/settings/pages/settings-page';
import { SiretPage } from '@/modules/onboarding/pages/siret-page';
import { TemplatesPage } from '@/modules/onboarding/pages/templates-page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <GuestGuard>
                  <LoginPage />
                </GuestGuard>
              }
            />
            <Route
              path="/verify"
              element={
                <GuestGuard>
                  <VerifyPage />
                </GuestGuard>
              }
            />
            {/* Onboarding — outside AppLayout */}
            <Route
              path="/onboarding/siret"
              element={
                <AuthGuard>
                  <SiretPage />
                </AuthGuard>
              }
            />
            <Route
              path="/onboarding/templates"
              element={
                <AuthGuard>
                  <TemplatesPage />
                </AuthGuard>
              }
            />
            {/* App routes — inside AppLayout */}
            <Route
              element={
                <AuthGuard>
                  <AppLayout />
                </AuthGuard>
              }
            >
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
