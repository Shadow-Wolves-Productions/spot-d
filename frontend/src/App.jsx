import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import SearchDirectory from './pages/SearchDirectory';
import ProfilePage from './pages/ProfilePage';
import CreateProfile from './pages/CreateProfile';
import Pricing from './pages/Pricing';
import Dashboard from './pages/Dashboard';
import ContactFAQ from './pages/ContactFAQ';
import CastingCalls from './pages/CastingCalls';
import CreateCastingCall from './pages/CreateCastingCall';
import CastingCallDetail from './pages/CastingCallDetail';
import AdminDashboard from './pages/AdminDashboard';
import Analytics from './pages/Analytics';
import CastingApplicationsKanban from './pages/CastingApplicationsKanban';
import ProfileBySlug from './pages/ProfileBySlug';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import CreateCompany from './pages/CreateCompany';
import CompanyProfilePage from './pages/CompanyProfilePage';
import Notifications from './pages/Notifications';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/search" element={<SearchDirectory />} />
        <Route path="/profile/:slug" element={<ProfilePage />} />
        <Route path="/create-profile" element={<CreateProfile />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contact" element={<ContactFAQ />} />
        <Route path="/casting" element={<CastingCalls />} />
        <Route path="/casting/new" element={<CreateCastingCall />} />
        <Route path="/casting/applications" element={<CastingApplicationsKanban />} />
        <Route path="/casting/:id" element={<CastingCallDetail />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/u/:slug" element={<ProfileBySlug />} />
        <Route path="/c/:slug" element={<CompanyProfilePage />} />
        <Route path="/create-company" element={<CreateCompany />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/login" element={<Login />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
