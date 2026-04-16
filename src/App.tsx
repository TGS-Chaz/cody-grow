import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";

import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import RequestAccessPage from "@/pages/auth/RequestAccessPage";
import NoAccessPage from "@/pages/auth/NoAccessPage";
import Dashboard from "@/pages/dashboard/Dashboard";
import PlaceholderPage from "@/pages/PlaceholderPage";

function ScrollToTop() {
  return null; // Will add scroll-to-top behavior later if needed
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/request-access" element={<RequestAccessPage />} />
              <Route path="/no-access" element={<NoAccessPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />

                  {/* Cultivation */}
                  <Route path="/cultivation/plants" element={<PlaceholderPage />} />
                  <Route path="/cultivation/grow-cycles" element={<PlaceholderPage />} />
                  <Route path="/cultivation/harvests" element={<PlaceholderPage />} />

                  {/* Inventory */}
                  <Route path="/inventory/products" element={<PlaceholderPage />} />
                  <Route path="/inventory/batches" element={<PlaceholderPage />} />
                  <Route path="/inventory/lab-testing" element={<PlaceholderPage />} />
                  <Route path="/inventory/production" element={<PlaceholderPage />} />

                  {/* Sales */}
                  <Route path="/sales/accounts" element={<PlaceholderPage />} />
                  <Route path="/sales/orders" element={<PlaceholderPage />} />
                  <Route path="/sales/fulfillment" element={<PlaceholderPage />} />

                  {/* Compliance */}
                  <Route path="/compliance/ccrs" element={<PlaceholderPage />} />
                  <Route path="/compliance/manifests" element={<PlaceholderPage />} />

                  {/* Settings */}
                  <Route path="/settings" element={<PlaceholderPage />} />
                  <Route path="/settings/strains" element={<PlaceholderPage />} />
                  <Route path="/settings/areas" element={<PlaceholderPage />} />
                </Route>
              </Route>

              {/* Catch-all: redirect to login */}
              <Route path="*" element={<LoginPage />} />
            </Routes>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
