import { BrowserRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext.js";
import { RequireAuth } from "./auth/RequireAuth.js";
import { CallbackPage } from "./auth/CallbackPage.js";
import { Layout } from "./components/Layout.js";
import { AgentListPage } from "./pages/AgentListPage.js";
import { AgentDetailPage } from "./pages/AgentDetailPage.js";
import { EmailReviewPage } from "./pages/EmailReviewPage.js";
import { CreateAgentPage } from "./pages/CreateAgentPage.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth/callback" element={<CallbackPage />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<AgentListPage />} />
              <Route path="agents/new" element={<CreateAgentPage />} />
              <Route path="agents/:id" element={<AgentDetailPage />} />
              <Route path="emails/review" element={<EmailReviewPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
