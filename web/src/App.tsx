import React from 'react';
import './index.css';

function App() {
  return (
    <div className="flex h-screen bg-background font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-white flex flex-col justify-between">
        <div>
          <div className="px-6 py-6 text-2xl font-bold tracking-wide">Solana DEX Trader</div>
          <nav className="mt-4">
            <ul>
              <li className="px-6 py-3 bg-primary rounded-l-lg font-semibold">Dashboard</li>
              <li className="px-6 py-3 hover:bg-primary/70 cursor-pointer">Tokens</li>
              <li className="px-6 py-3 hover:bg-primary/70 cursor-pointer">Positions</li>
              <li className="px-6 py-3 hover:bg-primary/70 cursor-pointer">Logs</li>
              <li className="px-6 py-3 hover:bg-primary/70 cursor-pointer">Configuration</li>
            </ul>
          </nav>
        </div>
        <div className="px-6 py-4 flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-success rounded-full" />
          <span className="text-sm text-success">Status: Connected</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto bg-background">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-textMain mb-2">Dashboard</h1>
          <div className="text-textSecondary">Pump Token Sniper</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-card p-6">
            <div className="text-textSecondary text-sm">Total Trades</div>
            <div className="text-2xl font-bold text-primary">15</div>
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
