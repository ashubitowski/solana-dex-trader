import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import './index.css';

// Page components
const Dashboard = () => (
  <>
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
  </>
);

const Tokens = () => (
  <>
    <h1 className="text-3xl font-bold text-gray-800 mb-4">Tokens</h1>
    <div className="bg-white rounded-lg shadow-card p-6">
      <h2 className="text-lg font-bold text-textMain mb-4">Token Watchlist</h2>
      <p>Your token monitoring and discovery dashboard will appear here.</p>
    </div>
  </>
);

const Positions = () => (
  <>
    <h1 className="text-3xl font-bold text-gray-800 mb-4">Positions</h1>
    <div className="bg-white rounded-lg shadow-card p-6">
      <h2 className="text-lg font-bold text-textMain mb-4">Current Positions</h2>
      <p>Your active and historical trading positions will appear here.</p>
    </div>
  </>
);

const Logs = () => (
  <>
    <h1 className="text-3xl font-bold text-gray-800 mb-4">Logs</h1>
    <div className="bg-white rounded-lg shadow-card p-6">
      <h2 className="text-lg font-bold text-textMain mb-4">System Logs</h2>
      <p>Trading activity and system logs will appear here.</p>
    </div>
  </>
);

const Configuration = () => {
  const [config, setConfig] = React.useState({
    // Trading parameters
    minimumLiquidity: 0.5,
    tradeAmount: 0.1,
    slippageTolerance: 2.5,
    maxActivePositions: 5,
    takeProfit: 50,
    stopLoss: 25,
    // Auto features
    autoSell: true,
    autoTrade: true,
    // Wallet settings
    walletAddress: '8xpG4...YE6P',
    privateKeySecured: true,
    rpcEndpoint: 'https://api.mainnet-beta.solana.com'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleSaveConfig = () => {
    // Here you would typically save to backend API
    console.log('Saving configuration:', config);
    alert('Configuration saved successfully!');
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-800">Bot Configuration</h1>
      </div>

      {/* Trading Parameters */}
      <div className="bg-white rounded-lg shadow-card p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {/* Minimum Liquidity */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Minimum Liquidity (SOL)</label>
            <input 
              type="number" 
              name="minimumLiquidity"
              value={config.minimumLiquidity}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">Minimum SOL in liquidity pool to consider buying</p>
          </div>

          {/* Trade Amount */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Trade Amount (SOL)</label>
            <input 
              type="number" 
              name="tradeAmount"
              value={config.tradeAmount}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">Amount of SOL to use for each trade</p>
          </div>

          {/* Slippage Tolerance */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Slippage Tolerance (%)</label>
            <input 
              type="number" 
              name="slippageTolerance"
              value={config.slippageTolerance}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">Maximum acceptable price difference due to slippage</p>
          </div>

          {/* Max Active Positions */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Max Active Positions</label>
            <input 
              type="number" 
              name="maxActivePositions"
              value={config.maxActivePositions}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">Maximum number of active positions allowed</p>
          </div>

          {/* Take Profit */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Take Profit (%)</label>
            <input 
              type="number" 
              name="takeProfit"
              value={config.takeProfit}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">Percentage increase to trigger sell</p>
          </div>

          {/* Stop Loss */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Stop Loss (%)</label>
            <input 
              type="number" 
              name="stopLoss"
              value={config.stopLoss}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">Percentage decrease to trigger sell</p>
          </div>
        </div>

        {/* Auto features */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex items-center">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                name="autoSell"
                checked={config.autoSell} 
                onChange={handleInputChange}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-gray-700 font-medium">Auto Sell</span>
            </label>
            <p className="text-sm text-gray-500 ml-4">Automatically sell based on take profit/stop loss</p>
          </div>
          
          <div className="flex items-center">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                name="autoTrade"
                checked={config.autoTrade} 
                onChange={handleInputChange}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-gray-700 font-medium">Auto Trade</span>
            </label>
            <p className="text-sm text-gray-500 ml-4">Automatically trade newly detected tokens</p>
          </div>
        </div>
      </div>

      {/* Wallet Configuration */}
      <div className="bg-white rounded-lg shadow-card p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Wallet Configuration</h2>
        
        <div className="grid grid-cols-1 gap-y-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Wallet Address</label>
            <div className="flex">
              <input 
                type="text" 
                name="walletAddress"
                value={config.walletAddress}
                onChange={handleInputChange}
                className="flex-grow p-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
                readOnly
              />
              <button className="bg-gray-100 text-gray-700 px-4 rounded-r border border-l-0 border-gray-300 hover:bg-gray-200">
                Change
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-gray-700 font-medium mb-2">Private Key Status</label>
            <div className="flex items-center">
              <span className="mr-2">
                {config.privateKeySecured ? 
                  <span className="text-green-500">🔒 Secured</span> : 
                  <span className="text-red-500">🔓 Not Secured</span>
                }
              </span>
              <button className="text-sm text-blue-600 hover:text-blue-800">
                {config.privateKeySecured ? "Update Key" : "Secure Key"}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-gray-700 font-medium mb-2">RPC Endpoint</label>
            <select 
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              name="rpcEndpoint"
              value={config.rpcEndpoint}
              onChange={(e) => setConfig({...config, rpcEndpoint: e.target.value})}
            >
              <option value="https://api.mainnet-beta.solana.com">Solana Mainnet (Default)</option>
              <option value="https://api.devnet.solana.com">Solana Devnet</option>
              <option value="https://solana-api.projectserum.com">Project Serum</option>
              <option value="https://rpc.ankr.com/solana">Ankr</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button 
          onClick={handleSaveConfig}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Save Configuration
        </button>
      </div>
    </>
  );
};

function App() {
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
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tokens" element={<Tokens />} />
          <Route path="/positions" element={<Positions />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/configuration" element={<Configuration />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
