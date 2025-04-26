import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { signIn, isAuthenticated, signUp } from '../../services/auth';
import { notify } from '../../components/Notifications';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate invite code
    if (inviteCode !== 'YouAreAllowedToTest') {
      notify.error('Invalid invite code');
      return;
    }
    
    // Validate form
    if (!username || !password || !confirmPassword) {
      notify.error('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      notify.error('Passwords do not match');
      return;
    }
    
    try {
      setLoading(true);
      await signUp(username, password);
      notify.success('Registration successful! Please sign in.');
      setShowRegister(false);
    } catch (error) {
      console.error('Registration error:', error);
      notify.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
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
          onClick={() => setShowRegister(!showRegister)}
          className="w-full mt-4 bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-900 transition duration-200 flex items-center justify-center"
        >
          <span className="mr-2">📝</span> {showRegister ? 'Back to Login' : 'Register an Account'}
        </button>
        
        {showRegister && (
          <form onSubmit={handleRegister} className="space-y-4 mt-6 pt-6 border-t border-gray-300">
            <h2 className="text-xl font-semibold text-center mb-4">Create New Account</h2>
            
            <div>
              <label htmlFor="register-username" className="block text-gray-700 font-medium mb-2">Email</label>
              <input
                id="register-username"
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email"
                required
              />
            </div>
            
            <div>
              <label htmlFor="register-password" className="block text-gray-700 font-medium mb-2">Password</label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Create a password"
                required
              />
            </div>
            
            <div>
              <label htmlFor="confirm-password" className="block text-gray-700 font-medium mb-2">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm your password"
                required
              />
            </div>
            
            <div>
              <label htmlFor="invite-code" className="block text-gray-700 font-medium mb-2">Invite Code</label>
              <input
                id="invite-code"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your invite code"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition duration-200 disabled:bg-green-400"
              disabled={loading}
            >
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
