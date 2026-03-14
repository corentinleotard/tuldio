import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth-context';
import { AuthGuard, GuestGuard, RootRedirect } from '@/components/route-guards';
import { AppLayout } from '@/components/app-layout';
import { LoginPage } from '@/modules/auth/pages/login-page';
import { VerifyPage } from '@/modules/auth/pages/verify-page';
import { ChatPage } from '@/modules/chat/pages/chat-page';
import { DocumentsPage } from '@/modules/documents/pages/documents-page';
import { ClientsPage } from '@/modules/clients/pages/clients-page';
import { StatsPage } from '@/modules/stats/pages/stats-page';
import { SettingsPage } from '@/modules/settings/pages/settings-page';
import { AiCostsPage } from '@/modules/settings/pages/ai-costs-page';
import { DebugChatPage } from '@/modules/settings/pages/debug-chat-page';
import { CompanyPage } from '@/modules/settings/pages/company-page';
import { OnboardingPage } from '@/modules/onboarding/pages/onboarding-page';
import { PwaProvider } from '@/components/pwa-install-prompt';
import { Toaster } from 'sonner';

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
      <PwaProvider>
      <Toaster position="top-center" richColors closeButton />
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
              path="/onboarding"
              element={
                <AuthGuard>
                  <OnboardingPage />
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
              <Route path="/settings/company" element={<CompanyPage />} />
              <Route path="/settings/ai-costs" element={<AiCostsPage />} />
              <Route path="/settings/debug-chat" element={<DebugChatPage />} />
            </Route>
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      </PwaProvider>
    </QueryClientProvider>
  );
}
