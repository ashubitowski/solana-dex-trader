import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { signIn, isAuthenticated, signUp, forgotPassword, confirmForgotPassword } from '../../services/auth';
import { notify } from '../../components/Notifications';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showConfirmCode, setShowConfirmCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
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
  
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      notify.error('Please enter your email address');
      return;
    }
    
    try {
      setLoading(true);
      await forgotPassword(username);
      notify.success('Verification code sent to your email');
      setShowConfirmCode(true);
    } catch (error) {
      console.error('Forgot password error:', error);
      notify.error('Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleConfirmForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !verificationCode || !newPassword) {
      notify.error('Please fill in all fields');
      return;
    }
    
    try {
      setLoading(true);
      await confirmForgotPassword(username, verificationCode, newPassword);
      notify.success('Password reset successful! Please login with your new password.');
      setShowForgotPassword(false);
      setShowConfirmCode(false);
      setVerificationCode('');
      setNewPassword('');
    } catch (error) {
      console.error('Confirm forgot password error:', error);
      notify.error('Failed to reset password. Please check your verification code and try again.');
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
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4 py-8">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-xl md:text-2xl font-bold text-center mb-6">Login to Solana DEX Trader</h1>
        
        {!showRegister && !showForgotPassword && (
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
          
          <div className="mt-4 text-center">
            <button 
              type="button" 
              onClick={() => {
                setShowForgotPassword(true);
                setShowRegister(false);
              }}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Forgot Password?
            </button>
          </div>
        </form>
        )}
        
        {!showRegister && !showForgotPassword && (
          <div className="relative py-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-gray-500 text-sm">Or</span>
            </div>
          </div>
        )}
        
        {!showForgotPassword && (
          <button
            onClick={() => setShowRegister(!showRegister)}
            className="w-full mt-4 bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-900 transition duration-200 flex items-center justify-center"
          >
            <span className="mr-2">📝</span> {showRegister ? 'Back to Login' : 'Register an Account'}
          </button>
        )}
        
        {showForgotPassword && !showConfirmCode && (
          <form onSubmit={handleForgotPassword} className="space-y-4 mt-6">
            <h2 className="text-xl font-semibold text-center mb-4">Reset Password</h2>
            
            <div>
              <label htmlFor="forgot-email" className="block text-gray-700 font-medium mb-2">Email</label>
              <input
                id="forgot-email"
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition duration-200 disabled:bg-blue-400"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>
            
            <div className="flex justify-center mt-4">
              <button 
                type="button" 
                onClick={() => {
                  setShowForgotPassword(false);
                  setShowConfirmCode(false);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}
        
        {showForgotPassword && showConfirmCode && (
          <form onSubmit={handleConfirmForgotPassword} className="space-y-4 mt-6">
            <h2 className="text-xl font-semibold text-center mb-4">Verify Code</h2>
            
            <div>
              <label htmlFor="verification-code" className="block text-gray-700 font-medium mb-2">Verification Code</label>
              <input
                id="verification-code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter verification code"
                required
              />
            </div>
            
            <div>
              <label htmlFor="new-password" className="block text-gray-700 font-medium mb-2">New Password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new password"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition duration-200 disabled:bg-blue-400"
              disabled={loading}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            
            <div className="flex justify-center mt-4">
              <button 
                type="button" 
                onClick={() => {
                  setShowForgotPassword(false);
                  setShowConfirmCode(false);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}
        
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
