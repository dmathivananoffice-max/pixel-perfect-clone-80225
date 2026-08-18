import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { RouteGuard } from "@/components/RouteGuard";

// Route-level code splitting — each page becomes its own async chunk so
// visiting /dashboard no longer downloads CandidateIntake, EmployerPortal, etc.
const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const CandidateList = lazy(() => import("@/pages/CandidateList"));
const CandidateIntake = lazy(() => import("@/pages/CandidateIntake"));
const CandidateDetail = lazy(() => import("@/pages/CandidateDetail"));
const CandidateBin = lazy(() => import("@/pages/CandidateBin"));
const ScoringConfig = lazy(() => import("@/pages/ScoringConfig"));
const STIAssessment = lazy(() => import("@/pages/STIAssessment"));
const RecruiterDashboard = lazy(() => import("@/pages/RecruiterDashboard"));
const AgencyPortal = lazy(() => import("@/pages/AgencyPortal"));
const EmployerPortal = lazy(() => import("@/pages/EmployerPortal"));
const CandidatePortal = lazy(() => import("@/pages/CandidatePortal"));
const ContractSigning = lazy(() => import("@/pages/ContractSigning"));
const EmailCenter = lazy(() => import("@/pages/EmailCenter"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const RolesPermissions = lazy(() => import("@/pages/RolesPermissions"));
const Reports = lazy(() => import("@/pages/Reports"));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
        Loading…
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Full-screen module — no AppLayout chrome */}
          <Route
            path="/candidates/new"
            element={
              <RouteGuard>
                <CandidateIntake />
              </RouteGuard>
            }
          />
          <Route
            element={
              <RouteGuard>
                <AppLayout />
              </RouteGuard>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/candidates" element={<CandidateList />} />
            <Route path="/candidates/bin" element={<CandidateBin />} />
            <Route path="/candidates/:id" element={<CandidateDetail />} />
            <Route path="/candidates/:id/intake" element={<CandidateIntake />} />
            <Route path="/admin/scoring" element={<ScoringConfig />} />
            <Route path="/sti" element={<STIAssessment />} />
            <Route path="/sti/:candidateId" element={<STIAssessment />} />
            <Route path="/recruiter" element={<RecruiterDashboard />} />
            <Route path="/agency" element={<AgencyPortal />} />
            <Route path="/employer" element={<EmployerPortal />} />
            <Route path="/candidate" element={<CandidatePortal />} />
            <Route path="/contracts/:id/sign" element={<ContractSigning />} />
            <Route path="/emails" element={<EmailCenter />} />
            <Route path="/documents/import" element={<Navigate to="/candidates/new" replace />} />
            <Route path="/documents/bulk" element={<Navigate to="/candidates/new" replace />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/roles" element={<RolesPermissions />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster position="top-right" />
      <SonnerToaster position="bottom-right" richColors closeButton />
    </>
  );
}

export default App;
