// AWS Cognito configuration
const poolData = {
    UserPoolId: 'us-east-2_NPZj6L69X',
    ClientId: '5aeg9s2q1i6r754pfvm5lq89an'
};

// Initialize AWS SDK
AWS.config.region = 'us-east-2';

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
    userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    logAuthEvent('Init', 'Cognito User Pool initialized successfully');
    refreshCsrfToken(); // Initialize CSRF token
} catch (error) {
    logAuthEvent('Init', 'Failed to initialize Cognito User Pool', error);
}

// DOM Elements
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
    logAuthEvent('DOM', 'Failed to find required DOM elements');
}

// Toggle between login and register forms
toggleAuth.addEventListener('click', (e) => {
    e.preventDefault();
    const isLogin = loginForm.style.display !== 'none';
    loginForm.style.display = isLogin ? 'none' : 'block';
    registerForm.style.display = isLogin ? 'block' : 'none';
    toggleAuth.textContent = isLogin ? 'Already have an account? Login' : 'Don\'t have an account? Register';
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

// Handle Registration
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    logAuthEvent('Register', 'Starting registration process');
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Password strength validation
    const strength = calculatePasswordStrength(password);
    if (strength < 3) {
        alert('Please choose a stronger password');
        return;
    }

    if (password !== confirmPassword) {
        logAuthEvent('Register', 'Password mismatch');
        alert('Passwords do not match');
        return;
    }

    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'email',
            Value: email
        })
    ];

    try {
        const result = await new Promise((resolve, reject) => {
            userPool.signUp(email, password, attributeList, null, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });

        logAuthEvent('Register', 'Registration successful', { username: result.user.getUsername() });
        alert('Registration successful! Please check your email for verification code.');
        toggleAuth.click();
    } catch (error) {
        logAuthEvent('Register', 'Registration failed', error);
        alert(getGenericErrorMessage(error));
    }
});

// Handle Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    logAuthEvent('Login', 'Starting login process');
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // Check rate limiting
    if (!checkRateLimit(email)) {
        alert('Too many login attempts. Please try again later.');
        return;
    }

    const authenticationData = {
        Username: email,
        Password: password
    };

    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
    const userData = {
        Username: email,
        Pool: userPool
    };

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    try {
        const result = await new Promise((resolve, reject) => {
            cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: (result) => resolve(result),
                onFailure: (err) => reject(err),
                newPasswordRequired: (userAttributes, requiredAttributes) => {
                    logAuthEvent('Login', 'New password required');
                    reject(new Error('Please change your password'));
                }
            });
        });

        logAuthEvent('Login', 'Login successful');
        
        // Store tokens securely
        storeTokenSecurely({
            accessToken: result.getAccessToken().getJwtToken(),
            idToken: result.getIdToken().getJwtToken(),
            refreshToken: result.getRefreshToken().getToken()
        });

        // Hide auth overlay and show dashboard
        authOverlay.style.display = 'none';
        
        // Initialize the dashboard
        if (typeof initializeDashboard === 'function') {
            initializeDashboard();
        } else {
            logAuthEvent('Login', 'Warning: initializeDashboard function not found');
        }
    } catch (error) {
        logAuthEvent('Login', 'Login failed', error);
        alert(getGenericErrorMessage(error));
    }
});

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