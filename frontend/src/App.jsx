import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme/theme';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Weather from './pages/Weather';
import Compare from './pages/Compare';
import Annotate from './pages/Annotate';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Onboarding from './pages/Onboarding';
import AdminDashboard from './pages/AdminDashboard';
import ApiDemo from './components/ApiDemo';
import { AuthProvider } from './context/AuthContext';
import { PropertyProvider } from './context/PropertyContext';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } />
            <Route element={
              <ProtectedRoute>
                <PropertyProvider>
                  <DashboardLayout />
                </PropertyProvider>
              </ProtectedRoute>
            }>
              <Route path="/" element={<Dashboard />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/weather" element={<Weather />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/annotate" element={<Annotate />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/api-demo" element={<ApiDemo />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider >
  );
}

export default App;

