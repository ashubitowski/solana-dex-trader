import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

// Auth
import ProtectedRoute from './components/auth/ProtectedRoute';

// Pages
import Dashboard from './components/pages/Dashboard';
import Tokens from './components/pages/Tokens';
import Positions from './components/pages/Positions';
import Logs from './components/pages/Logs';
import Configuration from './components/pages/Configuration';
import Login from './components/pages/Login';

/**
 * Main App component that handles routing
 */
const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tokens" element={<Tokens />} />
        <Route path="/positions" element={<Positions />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/configuration" element={<Configuration />} />
      </Route>
      
      {/* Redirects */}
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
