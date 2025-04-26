import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { signIn, isAuthenticated } from '../../services/auth';
import { notify } from '../../components/Notifications';
import { useWalletContext } from '../../contexts/WalletContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();
  const { connectWallet } = useWalletContext();

  // Check if user is already authenticated
  React.useEffect(() => {
    const checkAuth = async () => {
      const auth = await isAuthenticated();
      setAuthenticated(auth);
      if (auth) {
        navigate('/');
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      notify.error('Please enter both username and password');
      return;
    }

    try {
      setLoading(true);
      await signIn(username, password);
      notify.success('Login successful');
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      notify.error('Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
      notify.success('Wallet connected successfully');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      notify.error('Failed to connect wallet');
    }
  };

  if (authenticated) {
    return <Navigate to="/" />;
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Login to Solana DEX Trader</h1>
        
        <form onSubmit={handleLogin} className="space-y-4 mb-6">
          <div>
            <label htmlFor="username" className="block text-gray-700 font-medium mb-2">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-gray-700 font-medium mb-2">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition duration-200 disabled:bg-blue-400"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="relative py-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-gray-500 text-sm">Or</span>
          </div>
        </div>
        
        <button
          onClick={handleConnectWallet}
          className="w-full mt-4 bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-900 transition duration-200 flex items-center justify-center"
        >
          <span className="mr-2">🔑</span> Connect Wallet
        </button>
      </div>
    </div>
  );
};

export default Login;
