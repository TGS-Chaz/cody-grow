import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { ProfileProvider } from "@/lib/profile";
import { OrgProvider } from "@/lib/org";

import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import RequestAccessPage from "@/pages/auth/RequestAccessPage";
import NoAccessPage from "@/pages/auth/NoAccessPage";
import Dashboard from "@/pages/dashboard/Dashboard";
import ProfilePage from "@/pages/ProfilePage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import SettingsHub from "@/pages/settings/SettingsHub";
import FacilitiesPage from "@/pages/settings/FacilitiesPage";
import FacilityDetailPage from "@/pages/settings/FacilityDetailPage";
import UsersRolesPage from "@/pages/settings/UsersRolesPage";
import EmployeesPage from "@/pages/settings/EmployeesPage";
import EmployeeDetailPage from "@/pages/settings/EmployeeDetailPage";
import { ShortcutsProvider } from "@/components/shared/KeyboardShortcuts";

function ScrollToTop() {
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <ProfileProvider>
        <OrgProvider>
        <ThemeProvider>
          <TooltipProvider>
            <ShortcutsProvider>
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
                    <Route path="/profile" element={<ProfilePage />} />

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
                    <Route path="/settings" element={<SettingsHub />} />
                    <Route path="/settings/facilities" element={<FacilitiesPage />} />
                    <Route path="/settings/facilities/:id" element={<FacilityDetailPage />} />
                    {/* Placeholder category routes */}
                    <Route path="/settings/organization" element={<PlaceholderPage />} />
                    <Route path="/settings/users" element={<UsersRolesPage />} />
                    <Route path="/settings/employees" element={<EmployeesPage />} />
                    <Route path="/settings/employees/:id" element={<EmployeeDetailPage />} />
                    <Route path="/settings/fleet" element={<PlaceholderPage />} />
                    <Route path="/settings/customer-setup" element={<PlaceholderPage />} />
                    <Route path="/settings/equipment" element={<PlaceholderPage />} />
                    <Route path="/settings/ccrs" element={<PlaceholderPage />} />
                    <Route path="/settings/ai" element={<PlaceholderPage />} />
                    <Route path="/settings/integrations" element={<PlaceholderPage />} />
                    <Route path="/settings/strains" element={<PlaceholderPage />} />
                    <Route path="/settings/areas" element={<PlaceholderPage />} />
                  </Route>
                </Route>

                {/* Catch-all: redirect to login */}
                <Route path="*" element={<LoginPage />} />
              </Routes>
            </ShortcutsProvider>
          </TooltipProvider>
        </ThemeProvider>
        </OrgProvider>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
