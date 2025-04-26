import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tokens" element={<Tokens />} />
        <Route path="positions" element={<Positions />} />
        <Route path="logs" element={<Logs />} />
        <Route path="configuration" element={<Configuration />} />
      </Route>
      <Route path="/login" element={<div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-6">Login to Solana DEX Trader</h1>
          <p className="text-center text-gray-600 mb-4">Please connect your wallet to continue</p>
          <button className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition duration-200">
            Connect Wallet
          </button>
        </div>
      </div>} />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
