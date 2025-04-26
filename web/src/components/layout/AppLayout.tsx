import React from 'react';
import { NavLink } from 'react-router-dom';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-lg">
        <div className="flex-grow">
          <div className="px-6 py-6 text-2xl font-bold tracking-wide leading-tight">Solana DEX Trader
            <div className="text-xs font-normal text-gray-400">Pump Token Sniper</div>
          </div>
          <nav className="mt-2">
            <ul className="space-y-1">
              <NavLink to="/" end>
                {({ isActive }) => (
                  <li className={`flex items-center px-6 py-3 rounded-l-lg ${isActive ? 'bg-blue-700 font-semibold' : 'hover:bg-blue-600/70 cursor-pointer'}`}>
                    <span className="mr-2">📊</span> Dashboard
                  </li>
                )}
              </NavLink>
              <NavLink to="/tokens">
                {({ isActive }) => (
                  <li className={`flex items-center px-6 py-3 rounded-l-lg ${isActive ? 'bg-blue-700 font-semibold' : 'hover:bg-blue-600/70 cursor-pointer'}`}>
                    <span className="mr-2">🪙</span> Tokens
                  </li>
                )}
              </NavLink>
              <NavLink to="/positions">
                {({ isActive }) => (
                  <li className={`flex items-center px-6 py-3 rounded-l-lg ${isActive ? 'bg-blue-700 font-semibold' : 'hover:bg-blue-600/70 cursor-pointer'}`}>
                    <span className="mr-2">📈</span> Positions
                  </li>
                )}
              </NavLink>
              <NavLink to="/logs">
                {({ isActive }) => (
                  <li className={`flex items-center px-6 py-3 rounded-l-lg ${isActive ? 'bg-blue-700 font-semibold' : 'hover:bg-blue-600/70 cursor-pointer'}`}>
                    <span className="mr-2">📄</span> Logs
                  </li>
                )}
              </NavLink>
              <NavLink to="/configuration">
                {({ isActive }) => (
                  <li className={`flex items-center px-6 py-3 rounded-l-lg ${isActive ? 'bg-blue-700 font-semibold' : 'hover:bg-blue-600/70 cursor-pointer'}`}>
                    <span className="mr-2">⚙️</span> Configuration
                  </li>
                )}
              </NavLink>
            </ul>
          </nav>
        </div>
        <div className="mt-auto px-6 py-4 flex items-center gap-2 border-t border-gray-800">
          <span className="inline-block w-2 h-2 bg-green-400 rounded-full" />
          <span className="text-sm text-green-400">Status: Connected</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
