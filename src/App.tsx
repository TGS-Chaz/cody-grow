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
import NotFoundPage from "@/pages/NotFoundPage";
import SettingsHub from "@/pages/settings/SettingsHub";
import FacilitiesPage from "@/pages/settings/FacilitiesPage";
import FacilityDetailPage from "@/pages/settings/FacilityDetailPage";
import UsersRolesPage from "@/pages/settings/UsersRolesPage";
import EmployeesPage from "@/pages/settings/EmployeesPage";
import EmployeeDetailPage from "@/pages/settings/EmployeeDetailPage";
import FleetPage from "@/pages/settings/FleetPage";
import CustomerSetupPage from "@/pages/settings/CustomerSetupPage";
import PriceListDetailPage from "@/pages/settings/PriceListDetailPage";
import EquipmentPage from "@/pages/settings/EquipmentPage";
import EquipmentDetailPage from "@/pages/settings/EquipmentDetailPage";
import CCRSSettingsPage from "@/pages/settings/CCRSSettingsPage";
import AIPreferencesPage from "@/pages/settings/AIPreferencesPage";
import IntegrationsPage from "@/pages/settings/IntegrationsPage";
import StrainsPage from "@/pages/cultivation/StrainsPage";
import StrainDetailPage from "@/pages/cultivation/StrainDetailPage";
import AreasPage from "@/pages/cultivation/AreasPage";
import AreaDetailPage from "@/pages/cultivation/AreaDetailPage";
import ProductsPage from "@/pages/cultivation/ProductsPage";
import ProductDetailPage from "@/pages/cultivation/ProductDetailPage";
import SourcesPage from "@/pages/cultivation/SourcesPage";
import SourceDetailPage from "@/pages/cultivation/SourceDetailPage";
import GrowBoardPage from "@/pages/cultivation/GrowBoardPage";
import PlantsPage from "@/pages/cultivation/PlantsPage";
import PlantDetailPage from "@/pages/cultivation/PlantDetailPage";
import CyclesPage from "@/pages/cultivation/CyclesPage";
import CycleDetailPage from "@/pages/cultivation/CycleDetailPage";
import HarvestsPage from "@/pages/cultivation/HarvestsPage";
import HarvestDetailPage from "@/pages/cultivation/HarvestDetailPage";
import BatchesPage from "@/pages/inventory/BatchesPage";
import BatchDetailPage from "@/pages/inventory/BatchDetailPage";
import QAPage from "@/pages/inventory/QAPage";
import QALotDetailPage from "@/pages/inventory/QALotDetailPage";
import ProductionPage from "@/pages/inventory/ProductionPage";
import ProductionRunDetailPage from "@/pages/inventory/ProductionRunDetailPage";
import BOMDetailPage from "@/pages/inventory/BOMDetailPage";
import AccountsPage from "@/pages/sales/AccountsPage";
import AccountDetailPage from "@/pages/sales/AccountDetailPage";
import OrdersPage from "@/pages/sales/OrdersPage";
import OrderDetailPage from "@/pages/sales/OrderDetailPage";
import ManifestsPage from "@/pages/sales/ManifestsPage";
import ManifestDetailPage from "@/pages/sales/ManifestDetailPage";
import TransfersPage from "@/pages/sales/TransfersPage";
import CCRSDashboardPage from "@/pages/compliance/CCRSDashboardPage";
import AuditLogPage from "@/pages/compliance/AuditLogPage";
import DisposalsPage from "@/pages/compliance/DisposalsPage";
import LabelsPage from "@/pages/compliance/LabelsPage";
import TasksPage from "@/pages/operations/TasksPage";
import GrowLogsPage from "@/pages/operations/GrowLogsPage";
import ReportsPage from "@/pages/reports/ReportsPage";
import ReportRunnerPage from "@/pages/reports/ReportRunnerPage";
import MarketplaceConfigPage from "@/pages/marketplace/MarketplaceConfigPage";
import PublicMenuPage from "@/pages/marketplace/PublicMenuPage";
import RecallsPage from "@/pages/compliance/RecallsPage";
import RecallDetailPage from "@/pages/compliance/RecallDetailPage";
import SuppliesPage from "@/pages/inventory/SuppliesPage";
import ImportPage from "@/pages/settings/ImportPage";
import EnvironmentDashboardPage from "@/pages/operations/EnvironmentDashboardPage";
import KioskPage from "@/pages/kiosk/KioskPage";
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
                {/* Public / kiosk routes */}
                <Route path="/menu/:slug" element={<PublicMenuPage />} />
                <Route path="/kiosk/*" element={<KioskPage />} />
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
                    <Route path="/cultivation/strains" element={<StrainsPage />} />
                    <Route path="/cultivation/strains/:id" element={<StrainDetailPage />} />
                    <Route path="/cultivation/areas" element={<AreasPage />} />
                    <Route path="/cultivation/areas/:id" element={<AreaDetailPage />} />
                    <Route path="/cultivation/products" element={<ProductsPage />} />
                    <Route path="/cultivation/products/:id" element={<ProductDetailPage />} />
                    <Route path="/cultivation/sources" element={<SourcesPage />} />
                    <Route path="/cultivation/sources/:id" element={<SourceDetailPage />} />
                    <Route path="/cultivation/board" element={<GrowBoardPage />} />
                    <Route path="/cultivation/plants" element={<PlantsPage />} />
                    <Route path="/cultivation/plants/:id" element={<PlantDetailPage />} />
                    <Route path="/cultivation/grow-cycles" element={<CyclesPage />} />
                    <Route path="/cultivation/grow-cycles/:id" element={<CycleDetailPage />} />
                    <Route path="/cultivation/cycles" element={<CyclesPage />} />
                    <Route path="/cultivation/cycles/:id" element={<CycleDetailPage />} />
                    <Route path="/cultivation/harvests" element={<HarvestsPage />} />
                    <Route path="/cultivation/harvests/:id" element={<HarvestDetailPage />} />

                    {/* Inventory */}
                    <Route path="/inventory/batches" element={<BatchesPage />} />
                    <Route path="/inventory/batches/:id" element={<BatchDetailPage />} />
                    <Route path="/inventory/qa" element={<QAPage />} />
                    <Route path="/inventory/qa/:id" element={<QALotDetailPage />} />
                    <Route path="/inventory/supplies" element={<SuppliesPage />} />
                    <Route path="/inventory/production" element={<ProductionPage />} />
                    <Route path="/inventory/production/bom/:id" element={<BOMDetailPage />} />
                    <Route path="/inventory/production/:id" element={<ProductionRunDetailPage />} />
                    <Route path="/inventory/labels" element={<PlaceholderPage />} />
                    <Route path="/inventory/disposals" element={<PlaceholderPage />} />

                    {/* Sales */}
                    <Route path="/sales/accounts" element={<AccountsPage />} />
                    <Route path="/sales/accounts/:id" element={<AccountDetailPage />} />
                    <Route path="/sales/orders" element={<OrdersPage />} />
                    <Route path="/sales/orders/:id" element={<OrderDetailPage />} />
                    <Route path="/sales/manifests" element={<ManifestsPage />} />
                    <Route path="/sales/manifests/:id" element={<ManifestDetailPage />} />
                    <Route path="/sales/transfers" element={<TransfersPage />} />
                    <Route path="/sales/fulfillment" element={<PlaceholderPage />} />

                    {/* Compliance */}
                    <Route path="/compliance/ccrs" element={<CCRSDashboardPage />} />
                    <Route path="/compliance/audit" element={<AuditLogPage />} />
                    <Route path="/compliance/disposals" element={<DisposalsPage />} />
                    <Route path="/compliance/labels" element={<LabelsPage />} />
                    <Route path="/compliance/recalls" element={<RecallsPage />} />
                    <Route path="/compliance/recalls/:id" element={<RecallDetailPage />} />
                    <Route path="/compliance/manifests" element={<PlaceholderPage />} />

                    {/* Operations */}
                    <Route path="/operations/tasks" element={<TasksPage />} />
                    <Route path="/operations/logs" element={<GrowLogsPage />} />
                    <Route path="/operations/environment" element={<EnvironmentDashboardPage />} />

                    {/* Reports */}
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/reports/:id" element={<ReportRunnerPage />} />

                    {/* Marketplace (authenticated config) */}
                    <Route path="/marketplace" element={<MarketplaceConfigPage />} />

                    {/* Settings */}
                    <Route path="/settings" element={<SettingsHub />} />
                    <Route path="/settings/facilities" element={<FacilitiesPage />} />
                    <Route path="/settings/facilities/:id" element={<FacilityDetailPage />} />
                    {/* Placeholder category routes */}
                    <Route path="/settings/organization" element={<PlaceholderPage />} />
                    <Route path="/settings/users" element={<UsersRolesPage />} />
                    <Route path="/settings/employees" element={<EmployeesPage />} />
                    <Route path="/settings/employees/:id" element={<EmployeeDetailPage />} />
                    <Route path="/settings/fleet" element={<FleetPage />} />
                    <Route path="/settings/customer-setup" element={<CustomerSetupPage />} />
                    <Route path="/settings/customer-setup/price-lists/:id" element={<PriceListDetailPage />} />
                    <Route path="/settings/equipment" element={<EquipmentPage />} />
                    <Route path="/settings/equipment/:id" element={<EquipmentDetailPage />} />
                    <Route path="/settings/ccrs" element={<CCRSSettingsPage />} />
                    <Route path="/settings/ai" element={<AIPreferencesPage />} />
                    <Route path="/settings/import" element={<ImportPage />} />
                    <Route path="/settings/integrations" element={<IntegrationsPage />} />
                    <Route path="/settings/strains" element={<PlaceholderPage />} />
                    <Route path="/settings/areas" element={<PlaceholderPage />} />

                    {/* 404 inside the app shell — keeps sidebar + header */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>

                {/* Unauthenticated catch-all — send to login */}
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
