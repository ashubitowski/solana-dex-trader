import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './index.css';

// Layout
import AppLayout from './components/layout/AppLayout';

// Pages
import Dashboard from './components/pages/Dashboard';
import Tokens from './components/pages/Tokens';
import Positions from './components/pages/Positions';
import Logs from './components/pages/Logs';
import Configuration from './components/pages/Configuration';

/**
 * Main App component that handles routing
 */
const App: React.FC = () => {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tokens" element={<Tokens />} />
        <Route path="/positions" element={<Positions />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/configuration" element={<Configuration />} />
      </Routes>
    </AppLayout>
  );
};

export default App;
