// AWS Cognito configuration
window.poolData = {
    UserPoolId: 'us-east-2_2NKnlyBUD',
    ClientId: '5srq6jqjh86d55jviandg5f71a'
};

// Initialize AWS SDK
AWS.config.update({
    region: 'us-east-2'
});

// --- Security & Config ---
const RATE_LIMIT_WINDOW = 300000; // 5 minutes in milliseconds
const MAX_ATTEMPTS = 5;
let loginAttempts = new Map();
let csrfToken = '';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let sessionTimer;

// --- Cognito User Pool Init ---
let userPool;
try {
    userPool = new AmazonCognitoIdentity.CognitoUserPool(window.poolData);
    console.log('[Auth Init]', 'Cognito User Pool initialized successfully');
} catch (error) {
    console.error('[Auth Init]', 'Failed to initialize Cognito User Pool', error);
}

// --- Helper Functions ---

function logAuthEvent(type, message, error = null) {
    console.log(`[Auth ${type}]`, message);
    if (error) {
        console.error('[Auth Error]', {
            type: type,
            message: getGenericErrorMessage(error),
            timestamp: new Date().toISOString(),
            originalError: error // Include original error for debugging
        });
    }
}

function generateCsrfToken() {
    const buffer = new Uint8Array(32);
    crypto.getRandomValues(buffer);
    return Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
}

function refreshCsrfToken() {
    csrfToken = generateCsrfToken();
    // Consider setting HttpOnly via backend if possible
    document.cookie = `XSRF-TOKEN=${csrfToken}; SameSite=Strict; Secure; Path=/`; 
    return csrfToken;
}

function calculatePasswordStrength(password) {
    let strength = 0;
    if (!password) return 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++; // Special character
    return strength;
}

function displayPasswordStrength(strength) {
    const strengthMeter = document.getElementById('passwordStrengthIndicator'); // Use a dedicated indicator element
    const strengthText = document.getElementById('passwordStrengthText'); // Optional text element
    if (!strengthMeter) return;

    const strengthLevels = [
        { text: 'Very Weak', color: '#ff0000', width: '20%' },
        { text: 'Weak', color: '#ff4500', width: '40%' },
        { text: 'Medium', color: '#ffa500', width: '60%' },
        { text: 'Strong', color: '#9acd32', width: '80%' },
        { text: 'Very Strong', color: '#008000', width: '100%' }
    ];

    const level = strength > 0 ? strengthLevels[strength - 1] : { text: '', color: '#ccc', width: '0%' };

    strengthMeter.style.width = level.width;
    strengthMeter.style.backgroundColor = level.color;
    if (strengthText) {
        strengthText.textContent = level.text;
    }
}

const AUTH_ERRORS = {
    UserNotConfirmedException: 'Please verify your email address. Check your inbox for a verification code.',
    UserNotFoundException: 'Incorrect email or password.',
    NotAuthorizedException: 'Incorrect email or password.',
    InvalidParameterException: 'Invalid input. Please check email format and password requirements.',
    InvalidPasswordException: 'Password does not meet requirements (min 8 chars, upper, lower, number, symbol).',
    UsernameExistsException: 'An account with this email already exists.',
    LimitExceededException: 'Attempt limit exceeded, please try again later.',
    default: 'An unexpected error occurred. Please try again later.'
};

function getGenericErrorMessage(error) {
    return AUTH_ERRORS[error.code] || error.message || AUTH_ERRORS.default;
}

function checkRateLimit(username) {
    const now = Date.now();
    const userAttempts = loginAttempts.get(username) || [];
    const recentAttempts = userAttempts.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    if (recentAttempts.length >= MAX_ATTEMPTS) {
        logAuthEvent('RateLimit', `Limit exceeded for ${username}`);
        return false;
    }
    recentAttempts.push(now);
    loginAttempts.set(username, recentAttempts);
    return true;
}

function showAuthMessage(type, message, formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const errorElement = form.querySelector('.error-message');
    const successElement = form.querySelector('.success-message');

    if (!errorElement || !successElement) {
        console.warn(`[Auth Message] Could not find error/success elements in form ${formId}`);
        alert(message); // Fallback to alert
        return;
    }

    if (type === 'error') {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        successElement.style.display = 'none';
    } else {
        successElement.textContent = message;
        successElement.style.display = 'block';
        errorElement.style.display = 'none';
    }
}

function clearAuthMessages(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const errorElement = form.querySelector('.error-message');
    const successElement = form.querySelector('.success-message');
    if (errorElement) errorElement.style.display = 'none';
    if (successElement) successElement.style.display = 'none';
}

async function checkAuthentication() {
    logAuthEvent('Check', 'Checking authentication status');
    if (!userPool) {
        logAuthEvent('Check', 'User pool not initialized');
        return false; // Cannot check if pool failed
    }
    const cognitoUser = userPool.getCurrentUser();

    if (cognitoUser != null) {
        try {
            const session = await new Promise((resolve, reject) => {
                cognitoUser.getSession((err, session) => {
                    if (err) { reject(err); return; }
                    resolve(session);
                });
            });

            if (session && session.isValid()) {
                logAuthEvent('Check', 'Valid session found');
                const authOverlay = document.getElementById('authOverlay');
                if(authOverlay) authOverlay.style.display = 'none';
                
                // Initialize dashboard only if authenticated
                if (typeof initializeDashboard === 'function') {
                    initializeDashboard(); // Assumes initializeDashboard is defined elsewhere (e.g., script.js)
                } else {
                    logAuthEvent('Check', 'Warning: initializeDashboard function not found');
                }
                resetSessionTimer(); // Start inactivity timer
                return true;
            } else {
                logAuthEvent('Check', 'Session invalid or expired');
                // Attempt refresh if needed, or ensure logout
            }
        } catch (error) {
            logAuthEvent('Check', 'Session check/refresh failed', error);
            // Ensure UI reflects logged-out state
            const authOverlay = document.getElementById('authOverlay');
            if(authOverlay) authOverlay.style.display = 'flex'; // Show login
        }
    } else {
        logAuthEvent('Check', 'No current user found');
        const authOverlay = document.getElementById('authOverlay');
        if(authOverlay) authOverlay.style.display = 'flex'; // Show login
    }
    return false;
}

function logout() {
    logAuthEvent('Logout', 'Starting logout process');
    clearTimeout(sessionTimer); // Stop inactivity timer
    if (!userPool) {
        logAuthEvent('Logout', 'User pool not initialized');
        localStorage.clear(); // Clear any potential leftover local storage
        window.location.reload(); // Reload to ensure logged-out state
        return;
    }
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
        cognitoUser.signOut();
        logAuthEvent('Logout', 'Cognito user signed out');
    }
    localStorage.clear();
    // Clear potential cookies (best effort for non-HttpOnly)
    document.cookie = `XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    // Add other potential cookies if needed
    logAuthEvent('Logout', 'Logout complete, reloading page');
    window.location.reload();
}
window.logout = logout; // Make globally accessible if called by HTML onclick

function resetSessionTimer() {
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(logout, SESSION_TIMEOUT);
}

// Add event listeners for user activity to reset timer
document.addEventListener('mousemove', resetSessionTimer, { passive: true });
document.addEventListener('keypress', resetSessionTimer, { passive: true });

// --- DOMContentLoaded --- 
// Main entry point for UI interactions
document.addEventListener('DOMContentLoaded', () => {
    logAuthEvent('DOM Ready', 'Initializing auth UI elements and listeners');
    refreshCsrfToken(); // Initialize CSRF token on load

    // --- Find DOM Elements ---
    const authOverlay = document.getElementById('authOverlay');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const toggleAuth = document.getElementById('toggleAuth');
    const forgotPassword = document.getElementById('forgotPassword');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const newPasswordForm = document.getElementById('newPasswordForm');
    const backToLogin = document.getElementById('backToLogin');
    const backToReset = document.getElementById('backToReset');
    const registerPasswordInput = document.getElementById('registerPassword');

    // Check if essential elements exist
    const requiredElements = {
        authOverlay, loginForm, registerForm, toggleAuth, forgotPassword,
        resetPasswordForm, newPasswordForm, backToLogin, backToReset, registerPasswordInput
    };
    const missingElements = Object.entries(requiredElements)
                              .filter(([key, el]) => !el)
                              .map(([key]) => key);

    if (missingElements.length > 0) {
        logAuthEvent('DOM Error', `Failed to find required DOM elements: ${missingElements.join(', ')}`);
        return; // Stop initialization if critical elements are missing
    }

    // --- Attach Event Listeners ---

    // Toggle between login/register
    toggleAuth.addEventListener('click', (e) => {
        e.preventDefault();
        clearAuthMessages('loginForm');
        clearAuthMessages('registerForm');
        const isLogin = loginForm.style.display !== 'none';
        loginForm.style.display = isLogin ? 'none' : 'block';
        registerForm.style.display = isLogin ? 'block' : 'none';
        resetPasswordForm.style.display = 'none'; // Hide reset forms too
        newPasswordForm.style.display = 'none';
        toggleAuth.textContent = isLogin ? 'Already have an account? Login' : "Don't have an account? Register";
        logAuthEvent('Toggle', `Switched to ${isLogin ? 'register' : 'login'} form`);
    });

    // Show reset password form
    forgotPassword.addEventListener('click', (e) => {
        e.preventDefault();
        clearAuthMessages('loginForm');
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        resetPasswordForm.style.display = 'block';
        newPasswordForm.style.display = 'none';
        logAuthEvent('Reset', 'Showing reset password form');
    });

    // Back to login from reset
    backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        clearAuthMessages('resetPasswordForm');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        resetPasswordForm.style.display = 'none';
        newPasswordForm.style.display = 'none';
        logAuthEvent('Reset', 'Returning to login form');
    });

    // Back to reset from new password
    backToReset.addEventListener('click', (e) => {
        e.preventDefault();
        clearAuthMessages('newPasswordForm');
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        resetPasswordForm.style.display = 'block';
        newPasswordForm.style.display = 'none';
        logAuthEvent('Reset', 'Returning to reset form');
    });

    // Password strength checker listener
    registerPasswordInput.addEventListener('input', (e) => {
        const strength = calculatePasswordStrength(e.target.value);
        displayPasswordStrength(strength);
    });

    // --- Form Submit Handlers ---

    let resetUser = null; // Variable to store user for password reset process

    // Handle password reset request (forgot password)
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAuthMessages('resetPasswordForm');
        logAuthEvent('Reset', 'Starting password reset process');
        const emailInput = document.getElementById('resetEmail');
        if (!emailInput || !userPool) return;
        const email = emailInput.value;
        const userData = { Username: email, Pool: userPool };
        resetUser = new AmazonCognitoIdentity.CognitoUser(userData);
        try {
            await new Promise((resolve, reject) => {
                resetUser.forgotPassword({ onSuccess: resolve, onFailure: reject });
            });
            logAuthEvent('Reset', 'Reset code sent successfully');
            showAuthMessage('success', 'Reset code sent to your email.', 'resetPasswordForm');
            resetPasswordForm.style.display = 'none';
            newPasswordForm.style.display = 'block';
        } catch (error) {
            logAuthEvent('Reset', 'Failed to send reset code', error);
            showAuthMessage('error', getGenericErrorMessage(error), 'resetPasswordForm');
        }
    });

    // Handle setting new password (after getting reset code)
    newPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAuthMessages('newPasswordForm');
        logAuthEvent('Reset', 'Setting new password');
        const codeInput = document.getElementById('resetCode');
        const newPasswordInput = document.getElementById('newPassword');
        const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
        if (!codeInput || !newPasswordInput || !confirmNewPasswordInput || !resetUser) return;
        const code = codeInput.value;
        const newPassword = newPasswordInput.value;
        const confirmNewPassword = confirmNewPasswordInput.value;
        if (newPassword !== confirmNewPassword) {
            showAuthMessage('error', 'New passwords do not match', 'newPasswordForm');
            return;
        }
        try {
            await new Promise((resolve, reject) => {
                resetUser.confirmForgotPassword(code, newPassword, { onSuccess: resolve, onFailure: reject });
            });
            logAuthEvent('Reset', 'Password reset successful');
            showAuthMessage('success', 'Password reset. Please login.', 'newPasswordForm');
            // Show login form after a delay
            setTimeout(() => {
                loginForm.style.display = 'block';
                resetPasswordForm.style.display = 'none';
                newPasswordForm.style.display = 'none';
                clearAuthMessages('newPasswordForm'); // Clear message before showing login
            }, 2000);
        } catch (error) {
            logAuthEvent('Reset', 'Failed to reset password', error);
            showAuthMessage('error', getGenericErrorMessage(error), 'newPasswordForm');
        }
    });

    // Handle Registration
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAuthMessages('registerForm');
        logAuthEvent('Register', 'Starting registration process');
        const emailInput = document.getElementById('registerEmail');
        const passwordInput = document.getElementById('registerPassword');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        if (!emailInput || !passwordInput || !confirmPasswordInput || !userPool) return;
        const email = emailInput.value;
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        if (password !== confirmPassword) {
             showAuthMessage('error', 'Passwords do not match', 'registerForm');
            return;
        }
        const attributeList = [ new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email }) ];
        try {
            // Basic client-side password check (Cognito enforces stricter rules)
            if(calculatePasswordStrength(password) < 4) {
                throw new Error('Password does not meet minimum strength requirements.');
            }
            const result = await new Promise((resolve, reject) => {
                userPool.signUp(email, password, attributeList, null, (err, result) => {
                    if (err) { reject(err); return; }
                    resolve(result);
                });
            });
            logAuthEvent('Register', 'Registration successful', { username: result.user.getUsername() });
            showAuthMessage('success', 'Registration successful! Check email for verification.', 'registerForm');
            // Optionally switch to login after a delay
            setTimeout(() => { toggleAuth.click(); }, 2000);
        } catch (error) {
            logAuthEvent('Register', 'Registration failed', error);
            showAuthMessage('error', getGenericErrorMessage(error), 'registerForm');
        }
    });

    // Handle Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAuthMessages('loginForm');
        logAuthEvent('Login', 'Starting login process');
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        if (!emailInput || !passwordInput || !userPool) return;
        const email = emailInput.value;
        const password = passwordInput.value;
        if (!checkRateLimit(email)) {
            showAuthMessage('error', 'Too many login attempts. Try again later.', 'loginForm');
            return;
        }
        const authenticationData = { Username: email, Password: password };
        const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
        const userData = { Username: email, Pool: userPool };
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
        try {
            const session = await new Promise((resolve, reject) => {
                cognitoUser.authenticateUser(authenticationDetails, { onSuccess: resolve, onFailure: reject });
            });
            logAuthEvent('Login', 'Login successful');
            // Backend should set HttpOnly cookies. Frontend reloads to let checkAuthentication handle UI.
            showAuthMessage('success', 'Login successful! Loading dashboard...', 'loginForm');
            refreshCsrfToken(); // Refresh CSRF token after login
            // Don't store tokens client-side if using HttpOnly cookies from backend
            // Check auth status again, which should hide overlay and init dashboard
            checkAuthentication(); 
            // Optionally force reload if checkAuthentication doesn't handle UI update properly
            // setTimeout(() => window.location.reload(), 500); 
        } catch (error) {
            logAuthEvent('Login', 'Login failed', error);
            showAuthMessage('error', getGenericErrorMessage(error), 'loginForm');
        }
    });

    // --- Initial Check ---
    checkAuthentication(); // Check auth status once DOM is ready and listeners are attached

}); // End of DOMContentLoaded listener 