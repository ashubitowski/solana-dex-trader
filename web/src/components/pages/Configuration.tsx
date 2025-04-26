import React, { useState, useEffect, ChangeEvent } from 'react';
import { useWalletContext } from '../../contexts/WalletContext';
import { configApi } from '../../services/api';
import { validateConfig } from '../../utils/validation';
import { notify } from '../../components/Notifications';
import { getUserData, updateUserData } from '../../services/auth';

const Configuration: React.FC = () => {
  const { publicKey } = useWalletContext();
  
  const [config, setConfig] = useState({
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
    walletAddress: publicKey || '8xpG4...YE6P',
    privateKeySecured: true,
    rpcEndpoint: 'https://api.mainnet-beta.solana.com'
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Fetch configuration when component mounts
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        
        // First try to get user-specific configuration from DynamoDB
        const userData = await getUserData();
        
        if (userData && userData.settings) {
          // Use user-specific settings from DynamoDB
          setConfig(prev => ({ 
            ...prev, 
            ...userData.settings,
            walletAddress: userData.walletAddress || publicKey || '8xpG4...YE6P',
            privateKeySecured: !!userData.privateKeySecured
          }));
          notify.success('User configuration loaded successfully');
        } else {
          // Fallback to general configuration API
          const data = await configApi.getConfig();
          setConfig(prev => ({ ...prev, ...data }));
          notify.success('Configuration loaded successfully');
        }
      } catch (error) {
        console.error('Error fetching configuration:', error);
        notify.error('Failed to load configuration');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchConfig();
  }, [publicKey]);
  
  // Update wallet address when connected
  useEffect(() => {
    if (publicKey) {
      setConfig(prev => ({ ...prev, walletAddress: publicKey }));
    }
  }, [publicKey]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value;
    
    setConfig(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveConfig = async () => {
    // Validate configuration
    const validation = validateConfig(config);
    if (!validation.isValid) {
      setErrors(validation.errors);
      notify.error('Please fix the errors before saving');
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Save to user-specific settings in DynamoDB
      await updateUserData({
        settings: {
          minimumLiquidity: config.minimumLiquidity,
          tradeAmount: config.tradeAmount,
          slippageTolerance: config.slippageTolerance,
          maxActivePositions: config.maxActivePositions,
          takeProfit: config.takeProfit,
          stopLoss: config.stopLoss,
          autoSell: config.autoSell,
          autoTrade: config.autoTrade,
          rpcEndpoint: config.rpcEndpoint
        },
        walletAddress: config.walletAddress,
        privateKeySecured: config.privateKeySecured
      });
      
      // Also save to general configuration API for backward compatibility
      await configApi.saveConfig(config);
      
      setIsSaving(false);
      notify.success('Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving configuration:', error);
      setIsSaving(false);
      notify.error('Failed to save configuration. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              step="0.1"
            />
            <p className="text-sm text-gray-500 mt-1">Minimum liquidity required for token detection</p>
          </div>

          {/* Trade Amount */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Trade Amount (SOL)</label>
            <input 
              type="number" 
              name="tradeAmount"
              value={config.tradeAmount}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0.01"
              step="0.01"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0.1"
              max="100"
              step="0.1"
            />
            <p className="text-sm text-gray-500 mt-1">Maximum price slippage allowed</p>
          </div>

          {/* Max Active Positions */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Max Active Positions</label>
            <input 
              type="number" 
              name="maxActivePositions"
              value={config.maxActivePositions}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="100"
              step="1"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="1000"
              step="1"
            />
            <p className="text-sm text-gray-500 mt-1">Percentage gain to trigger sell</p>
          </div>

          {/* Stop Loss */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Stop Loss (%)</label>
            <input 
              type="number" 
              name="stopLoss"
              value={config.stopLoss}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="100"
              step="1"
            />
            <p className="text-sm text-gray-500 mt-1">Percentage loss to trigger sell</p>
          </div>
        </div>
      </div>

      {/* Auto Features */}
      <div className="bg-white rounded-lg shadow-card p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Auto Features</h2>
        <div className="space-y-4">
          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="autoSell"
              name="autoSell"
              checked={config.autoSell}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="autoSell" className="ml-2 block text-gray-700">Auto Sell</label>
            <p className="text-sm text-gray-500 ml-6">Automatically sell tokens when take profit or stop loss is triggered</p>
          </div>
          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="autoTrade"
              name="autoTrade"
              checked={config.autoTrade}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="autoTrade" className="ml-2 block text-gray-700">Auto Trade</label>
            <p className="text-sm text-gray-500 ml-6">Automatically buy tokens that meet your criteria</p>
          </div>
        </div>
      </div>

      {/* Wallet Settings */}
      <div className="bg-white rounded-lg shadow-card p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Wallet Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Wallet Address</label>
            <input 
              type="text" 
              name="walletAddress"
              value={config.walletAddress}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              readOnly
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Private Key Status</label>
            <div className="flex items-center mt-2">
              <span className={`inline-block w-3 h-3 rounded-full ${config.privateKeySecured ? 'bg-green-500' : 'bg-red-500'} mr-2`}></span>
              <span className="text-gray-700">{config.privateKeySecured ? 'Secured' : 'Not Secured'}</span>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-gray-700 font-medium mb-2">RPC Endpoint</label>
            <select 
              name="rpcEndpoint"
              value={config.rpcEndpoint}
              onChange={handleSelectChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </>
  );
};

export default Configuration;
