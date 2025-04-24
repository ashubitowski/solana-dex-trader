import React from 'react';
import './index.css';

function App() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col justify-between shadow-lg">
        <div>
          <div className="px-6 py-6 text-2xl font-bold tracking-wide leading-tight">Solana DEX Trader
            <div className="text-xs font-normal text-gray-400">Pump Token Sniper</div>
          </div>
          <nav className="mt-2">
            <ul className="space-y-1">
              <li className="flex items-center px-6 py-3 bg-blue-700 rounded-l-lg font-semibold">
                <span className="mr-2">📊</span> Dashboard
              </li>
              <li className="flex items-center px-6 py-3 hover:bg-blue-600/70 cursor-pointer rounded-l-lg">
                <span className="mr-2">🪙</span> Tokens
              </li>
              <li className="flex items-center px-6 py-3 hover:bg-blue-600/70 cursor-pointer rounded-l-lg">
                <span className="mr-2">📈</span> Positions
              </li>
              <li className="flex items-center px-6 py-3 hover:bg-blue-600/70 cursor-pointer rounded-l-lg">
                <span className="mr-2">📄</span> Logs
              </li>
              <li className="flex items-center px-6 py-3 hover:bg-blue-600/70 cursor-pointer rounded-l-lg">
                <span className="mr-2">⚙️</span> Configuration
              </li>
            </ul>
          </nav>
        </div>
        <div className="px-6 py-4 flex items-center gap-2 border-t border-gray-800">
          <span className="inline-block w-2 h-2 bg-green-400 rounded-full" />
          <span className="text-sm text-green-400">Status: Connected</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-0">Dashboard</h1>
            <div className="text-gray-500">Wallet Status</div>
          </div>
          <button className="px-4 py-1.5 bg-white border border-blue-500 text-blue-600 rounded hover:bg-blue-50 text-sm font-semibold transition">⟳ Refresh</button>
        </div>

        {/* Wallet Status Card */}
        <div className="bg-white rounded-lg shadow-card p-6 flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <div className="text-gray-500 text-sm">Address:</div>
            <div className="font-mono text-gray-800">8xpG4...YE6P</div>
          </div>
          <div className="mt-4 md:mt-0">
            <div className="text-gray-500 text-sm">Balance:</div>
            <div className="font-mono text-gray-800">10.5432 SOL</div>
          </div>
          <div className="mt-4 md:mt-0">
            <div className="text-gray-500 text-sm">RPC Endpoint:</div>
            <div className="font-mono text-gray-800">https://api.mainnet-beta.solana.com</div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-card p-6 flex flex-col items-center">
            <div className="text-gray-500 text-sm">Total Trades</div>
            <div className="text-2xl font-bold text-blue-700">15</div>
          </div>
          <div className="bg-white rounded-lg shadow-card p-6">
            <div className="text-textSecondary text-sm">Profitable Trades</div>
            <div className="text-2xl font-bold text-primary">9</div>
          </div>
          <div className="bg-white rounded-lg shadow-card p-6">
            <div className="text-textSecondary text-sm">Success Rate</div>
            <div className="text-2xl font-bold text-primary">60.0%</div>
          </div>
          <div className="bg-white rounded-lg shadow-card p-6">
            <div className="text-textSecondary text-sm">Total Profit</div>
            <div className="text-2xl font-bold text-success">2.4560 SOL</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-card p-6 mb-8">
          <h2 className="text-lg font-bold text-textMain mb-4">Wallet Status</h2>
          <div className="flex flex-col md:flex-row gap-8">
            <div>
              <div className="text-textSecondary text-sm">Address</div>
              <div className="font-mono text-textMain">8xpG4...YE6P</div>
            </div>
            <div>
              <div className="text-textSecondary text-sm">Balance</div>
              <div className="font-mono text-textMain">10.5432 SOL</div>
            </div>
            <div>
              <div className="text-textSecondary text-sm">RPC Endpoint</div>
              <div className="font-mono text-textMain">https://api.mainnet-beta.solana.com</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-card p-6">
          <h2 className="text-lg font-bold text-textMain mb-4">Recently Detected Tokens</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-textMain">SAMO</div>
                <div className="text-xs text-textSecondary font-mono">7xKxQ...qe4U</div>
                <div className="text-success text-sm">Liquidity: 24356.7800 SOL</div>
              </div>
              <div className="flex gap-2">
                <button className="bg-primary text-white px-3 py-1 rounded hover:bg-primary/90">Buy</button>
                <button className="bg-success text-white px-3 py-1 rounded hover:bg-success/90">Info</button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-textMain">BONK</div>
                <div className="text-xs text-textSecondary font-mono">DezQAX...B63</div>
                <div className="text-success text-sm">Liquidity: $2890.4500 SOL</div>
              </div>
              <div className="flex gap-2">
                <button className="bg-primary text-white px-3 py-1 rounded hover:bg-primary/90">Buy</button>
                <button className="bg-success text-white px-3 py-1 rounded hover:bg-success/90">Info</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
