import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/store/authStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { RouteGuard } from '@/components/RouteGuard';

// Pages
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import CandidateList from '@/pages/CandidateList';
import CandidateIntake from '@/pages/CandidateIntake';
import CandidateDetail from '@/pages/CandidateDetail';
import ScoringConfig from '@/pages/ScoringConfig';
import STIAssessment from '@/pages/STIAssessment';
import RecruiterDashboard from '@/pages/RecruiterDashboard';
import AgencyPortal from '@/pages/AgencyPortal';
import EmployerPortal from '@/pages/EmployerPortal';
import CandidatePortal from '@/pages/CandidatePortal';
import ContractSigning from '@/pages/ContractSigning';
import EmailCenter from '@/pages/EmailCenter';
import DocumentImport from '@/pages/DocumentImport';
import UserManagement from '@/pages/UserManagement';
import Reports from '@/pages/Reports';

function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
        {/* Full-screen module — no AppLayout chrome */}
        <Route path="/candidates/new" element={<RouteGuard><CandidateIntake /></RouteGuard>} />
        <Route element={<RouteGuard><AppLayout /></RouteGuard>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/candidates" element={<CandidateList />} />
          <Route path="/candidates/:id" element={<CandidateDetail />} />
          <Route path="/admin/scoring" element={<ScoringConfig />} />
          <Route path="/sti" element={<STIAssessment />} />
          <Route path="/sti/:candidateId" element={<STIAssessment />} />
          <Route path="/recruiter" element={<RecruiterDashboard />} />
          <Route path="/agency" element={<AgencyPortal />} />
          <Route path="/employer" element={<EmployerPortal />} />
          <Route path="/candidate" element={<CandidatePortal />} />
          <Route path="/contracts/:id/sign" element={<ContractSigning />} />
          <Route path="/emails" element={<EmailCenter />} />
          <Route path="/documents/import" element={<DocumentImport />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
      <Toaster position="top-right" />
      <SonnerToaster position="bottom-right" richColors closeButton />
    </>
  );
}

export default App;
