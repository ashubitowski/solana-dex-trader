import React, { ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  return (
    <div className="flex h-screen bg-gray-50 font-sans relative">
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-20">
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-md bg-gray-900 text-white focus:outline-none"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-6 w-6" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            {sidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden"
          onClick={toggleSidebar}
        ></div>
      )}
      
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 left-0 w-64 bg-gray-900 text-white flex flex-col z-20 transition-transform duration-300 ease-in-out`}
      >
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
      <main className="flex-1 p-4 md:p-10 overflow-y-auto bg-gray-50 w-full">
        <div className="md:ml-0 mt-12 md:mt-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
