// AWS Cognito configuration
window.poolData = {
    UserPoolId: 'us-east-2_2NKnlyBUD',
    ClientId: '5srq6jqjh86d55jviandg5f71a'
};

// Initialize AWS SDK with explicit configuration
AWS.config.update({
    region: 'us-east-2'
});

// Security configuration
const RATE_LIMIT_WINDOW = 300000; // 5 minutes in milliseconds
const MAX_ATTEMPTS = 5;
let loginAttempts = new Map(); // Store login attempts

// CSRF token management
let csrfToken = '';

function generateCsrfToken() {
    const buffer = new Uint8Array(32);
    crypto.getRandomValues(buffer);
    return Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
}

function refreshCsrfToken() {
    csrfToken = generateCsrfToken();
    document.cookie = `XSRF-TOKEN=${csrfToken}; SameSite=Strict; Secure`;
    return csrfToken;
}

// Password strength checker
function calculatePasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]+/)) strength++;
    if (password.match(/[A-Z]+/)) strength++;
    if (password.match(/[0-9]+/)) strength++;
    if (password.match(/[^a-zA-Z0-9]+/)) strength++;
    return strength;
}

function displayPasswordStrength(strength) {
    const strengthMeter = document.getElementById('passwordStrength');
    if (!strengthMeter) return;
    
    const strengthTexts = ['Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
    const strengthColors = ['#ff0000', '#ff4500', '#ffa500', '#9acd32', '#008000'];
    
    strengthMeter.style.width = `${(strength / 5) * 100}%`;
    strengthMeter.style.backgroundColor = strengthColors[strength - 1];
    strengthMeter.textContent = strengthTexts[strength - 1];
}

// Secure token storage using HttpOnly cookies
function storeTokenSecurely(tokens) {
    // These will be set by the server with HttpOnly flag
    document.cookie = `accessToken=${tokens.accessToken}; SameSite=Strict; Secure`;
    document.cookie = `idToken=${tokens.idToken}; SameSite=Strict; Secure`;
    document.cookie = `refreshToken=${tokens.refreshToken}; SameSite=Strict; Secure`;
}

// Generic error messages
const AUTH_ERRORS = {
    UserNotConfirmedException: 'Please verify your email address',
    UserNotFoundException: 'Authentication failed',
    NotAuthorizedException: 'Authentication failed',
    InvalidParameterException: 'Invalid input provided',
    default: 'An error occurred. Please try again later'
};

function getGenericErrorMessage(error) {
    return AUTH_ERRORS[error.code] || AUTH_ERRORS.default;
}

// Rate limiting
function checkRateLimit(username) {
    const now = Date.now();
    const userAttempts = loginAttempts.get(username) || [];
    
    // Clean up old attempts
    const recentAttempts = userAttempts.filter(timestamp => 
        now - timestamp < RATE_LIMIT_WINDOW
    );
    
    if (recentAttempts.length >= MAX_ATTEMPTS) {
        return false;
    }
    
    recentAttempts.push(now);
    loginAttempts.set(username, recentAttempts);
    return true;
}

// Logging function
function logAuthEvent(type, message, error = null) {
    console.log(`[Auth ${type}]`, message);
    if (error) {
        console.error('[Auth Error]', {
            type: type,
            message: getGenericErrorMessage(error),
            timestamp: new Date().toISOString()
        });
    }
}

// Initialize Cognito User Pool
let userPool;
try {
    userPool = new AmazonCognitoIdentity.CognitoUserPool(window.poolData);
    logAuthEvent('Init', 'Cognito User Pool initialized successfully');
    refreshCsrfToken(); // Initialize CSRF token
} catch (error) {
    logAuthEvent('Init', 'Failed to initialize Cognito User Pool', error);
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    logAuthEvent('DOM Ready', 'Initializing auth UI elements');

    // DOM Elements (find them *after* DOM is ready)
    const authOverlay = document.getElementById('authOverlay');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const toggleAuth = document.getElementById('toggleAuth');
    const forgotPassword = document.getElementById('forgotPassword');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const newPasswordForm = document.getElementById('newPasswordForm');
    const backToLogin = document.getElementById('backToLogin');
    const backToReset = document.getElementById('backToReset');

    if (!authOverlay || !loginForm || !registerForm || !toggleAuth || !forgotPassword || 
        !resetPasswordForm || !newPasswordForm || !backToLogin || !backToReset) {
        logAuthEvent('DOM Error', 'Failed to find required DOM elements even after DOMContentLoaded');
        // If this still fails, there's a definite mismatch between HTML and expected IDs
        return; // Stop execution if elements are missing
    }

    // --- Event Listeners and Form Handlers --- 
    // (Move all the addEventListener calls and related logic inside here)

    // Toggle between login and register forms
    toggleAuth.addEventListener('click', (e) => {
        e.preventDefault();
        const isLogin = loginForm.style.display !== 'none';
        loginForm.style.display = isLogin ? 'none' : 'block';
        registerForm.style.display = isLogin ? 'block' : 'none';
        toggleAuth.textContent = isLogin ? 'Already have an account? Login' : "Don't have an account? Register";
        logAuthEvent('Toggle', `Switched to ${isLogin ? 'register' : 'login'} form`);
    });

    // Password reset state
    let resetUser = null;

    // Show reset password form
    forgotPassword.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        resetPasswordForm.style.display = 'block';
        newPasswordForm.style.display = 'none';
        logAuthEvent('Reset', 'Showing reset password form');
    });

    // Back to login from reset
    backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'block';
        resetPasswordForm.style.display = 'none';
        newPasswordForm.style.display = 'none';
        logAuthEvent('Reset', 'Returning to login form');
    });

    // Back to reset from new password
    backToReset.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        resetPasswordForm.style.display = 'block';
        newPasswordForm.style.display = 'none';
        logAuthEvent('Reset', 'Returning to reset form');
    });

    // Handle password reset request
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        logAuthEvent('Reset', 'Starting password reset process');
        
        const email = document.getElementById('resetEmail').value;
        const userData = {
            Username: email,
            Pool: userPool
        };

        resetUser = new AmazonCognitoIdentity.CognitoUser(userData);

        try {
            await new Promise((resolve, reject) => {
                resetUser.forgotPassword({
                    onSuccess: () => resolve(),
                    onFailure: (err) => reject(err)
                });
            });

            logAuthEvent('Reset', 'Reset code sent successfully');
            alert('Reset code sent to your email. Please check your inbox.');
            
            // Show new password form
            loginForm.style.display = 'none';
            resetPasswordForm.style.display = 'none';
            newPasswordForm.style.display = 'block';
        } catch (error) {
            logAuthEvent('Reset', 'Failed to send reset code', error);
            alert('Failed to send reset code: ' + error.message);
        }
    });

    // Handle new password submission
    newPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        logAuthEvent('Reset', 'Setting new password');
        
        const code = document.getElementById('resetCode').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmNewPassword) {
            logAuthEvent('Reset', 'New passwords do not match');
            alert('New passwords do not match');
            return;
        }

        try {
            await new Promise((resolve, reject) => {
                resetUser.confirmForgotPassword(code, newPassword, {
                    onSuccess: () => resolve(),
                    onFailure: (err) => reject(err)
                });
            });

            logAuthEvent('Reset', 'Password reset successful');
            alert('Password has been reset successfully. Please login with your new password.');
            
            // Show login form
            loginForm.style.display = 'block';
            resetPasswordForm.style.display = 'none';
            newPasswordForm.style.display = 'none';
        } catch (error) {
            logAuthEvent('Reset', 'Failed to reset password', error);
            alert('Failed to reset password: ' + error.message);
        }
    });

    // --- Login / Register Form Handlers --- 
    // (Assuming these are defined elsewhere or move them here)
    // Example: Attach login handler (ensure handleLogin is defined)
    // if (typeof handleLogin === 'function') {
    //     loginForm.addEventListener('submit', (e) => {
    //         e.preventDefault();
    //         const email = document.getElementById('loginEmail').value;
    //         const password = document.getElementById('loginPassword').value;
    //         handleLogin(email, password);
    //     });
    // } else {
    //     logAuthEvent('DOM Error', 'handleLogin function not found');
    // }

    // Example: Attach register handler (ensure handleRegister is defined)
    // if (typeof handleRegister === 'function') {
    //     registerForm.addEventListener('submit', (e) => {
    //         e.preventDefault();
    //         const email = document.getElementById('registerEmail').value;
    //         const password = document.getElementById('registerPassword').value;
    //         const confirmPassword = document.getElementById('confirmPassword').value;
    //         // Add name if needed
    //         handleRegister(email, password, confirmPassword); 
    //     });
    // } else {
    //     logAuthEvent('DOM Error', 'handleRegister function not found');
    // }

    // --- Other Initializations --- 
    // Check authentication status after setting up UI listeners
    if (typeof checkAuthentication === 'function') {
        checkAuthentication();
    } else {
        logAuthEvent('DOM Error', 'checkAuthentication function not found');
    }

}); // End of DOMContentLoaded listener

// --- Functions defined outside DOMContentLoaded --- 
// (Keep validatePassword, updatePasswordStrength, generateCsrfToken, etc. here)
// ...

// --- Global Functions (potentially called by HTML onclick or other scripts) ---
// Ensure functions like logout() are globally accessible if needed
// window.logout = logout; // Example if called directly from HTML

// Make sure checkAuthentication, handleLogin, handleRegister are defined
// ... (rest of the file with function definitions) ...

// Check if user is already authenticated
async function checkAuthentication() {
    logAuthEvent('Check', 'Checking authentication status');
    const cognitoUser = userPool.getCurrentUser();
    
    if (cognitoUser != null) {
        try {
            const session = await new Promise((resolve, reject) => {
                cognitoUser.getSession((err, session) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(session);
                });
            });
            
            if (session.isValid()) {
                logAuthEvent('Check', 'Valid session found');
                authOverlay.style.display = 'none';
                
                if (typeof initializeDashboard === 'function') {
                    initializeDashboard();
                } else {
                    logAuthEvent('Check', 'Warning: initializeDashboard function not found');
                }
            } else {
                logAuthEvent('Check', 'Session invalid');
            }
        } catch (error) {
            logAuthEvent('Check', 'Session check failed', error);
        }
    } else {
        logAuthEvent('Check', 'No current user found');
    }
}

// Add logout functionality
window.logout = function() {
    logAuthEvent('Logout', 'Starting logout process');
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
        cognitoUser.signOut();
        localStorage.clear();
        logAuthEvent('Logout', 'Logout successful');
        window.location.reload();
    } else {
        logAuthEvent('Logout', 'No user to logout');
    }
};

// Check authentication status when page loads
document.addEventListener('DOMContentLoaded', checkAuthentication);

// Add session timeout handling
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let sessionTimer;

function resetSessionTimer() {
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(logout, SESSION_TIMEOUT);
}

// Add event listeners for user activity
document.addEventListener('mousemove', resetSessionTimer);
document.addEventListener('keypress', resetSessionTimer);

// Initialize session timer
resetSessionTimer();

// Export necessary functions
window.logout = logout;
window.refreshCsrfToken = refreshCsrfToken;

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    // Function to show error message
    const showError = (message) => {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
    };

    // Function to show success message
    const showSuccess = (message) => {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    };

    // Function to handle login
    const handleLogin = async (email, password) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            // Store the token in localStorage
            localStorage.setItem('token', data.token);
            
            // Show success message
            showSuccess('Login successful! Redirecting...');

            // Redirect to dashboard after successful login
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);

        } catch (error) {
            showError(error.message || 'An error occurred during login');
        }
    };

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Basic validation
        if (!email || !password) {
            showError('Please fill in all fields');
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showError('Please enter a valid email address');
            return;
        }

        // Attempt login
        await handleLogin(email, password);
    });
}); 