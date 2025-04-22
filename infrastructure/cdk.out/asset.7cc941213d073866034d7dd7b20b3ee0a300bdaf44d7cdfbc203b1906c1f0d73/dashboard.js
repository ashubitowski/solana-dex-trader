// Dashboard initialization
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication first
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
        document.getElementById('authOverlay').style.display = 'block';
        document.querySelector('.dashboard-container').style.display = 'none';
        return;
    }

    // Initialize dashboard if authenticated
    initializeDashboard();
});

// Initialize dashboard
function initializeDashboard() {
    // Set active navigation
    setActiveNav('dashboard');
    
    // Initialize Socket.IO connection if available
    initializeSocketConnection();
    
    // Initialize UI components
    initializeUI();
    
    // Setup event listeners
    setupEventListeners();
}

// Set active navigation link
function setActiveNav(navId) {
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`.sidebar .nav-link[data-nav="${navId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Initialize UI components
function initializeUI() {
    updateWalletUI();
    updateStatsUI();
    updateTradingUI();
    updateConnectionStatus('Connected', 'success');
}

// Update wallet UI
function updateWalletUI() {
    const walletStatus = document.getElementById('walletStatus');
    const walletAddress = document.getElementById('walletAddress');
    const walletBalance = document.getElementById('walletBalance');
    
    if (walletStatus) walletStatus.textContent = 'Not Connected';
    if (walletAddress) walletAddress.textContent = 'Not Available';
    if (walletBalance) walletBalance.textContent = '0 SOL';
}

// Update stats UI
function updateStatsUI() {
    const elements = {
        tokensDetected: document.getElementById('tokensDetected'),
        tradesExecuted: document.getElementById('tradesExecuted'),
        successRate: document.getElementById('successRate'),
        profitLoss: document.getElementById('profitLoss')
    };
    
    if (elements.tokensDetected) elements.tokensDetected.textContent = '0';
    if (elements.tradesExecuted) elements.tradesExecuted.textContent = '0';
    if (elements.successRate) elements.successRate.textContent = '0%';
    if (elements.profitLoss) elements.profitLoss.textContent = '0 SOL';
}

// Update trading UI
function updateTradingUI() {
    const elements = {
        tradingStatus: document.getElementById('tradingStatus'),
        startBtn: document.getElementById('startTradingBtn'),
        stopBtn: document.getElementById('stopTradingBtn')
    };
    
    if (elements.tradingStatus) elements.tradingStatus.textContent = 'Inactive';
    if (elements.startBtn) elements.startBtn.disabled = false;
    if (elements.stopBtn) elements.stopBtn.disabled = true;
}

// Update connection status
function updateConnectionStatus(message, type) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;
    
    statusElement.textContent = message;
    statusElement.className = `text-${type}`;
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const navId = link.getAttribute('data-nav');
            setActiveNav(navId);
            showSection(navId);
        });
    });
    
    // Refresh buttons
    document.querySelectorAll('.btn-refresh').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.getAttribute('data-refresh');
            refreshSection(section);
        });
    });
}

// Show/hide sections
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    
    const targetSection = document.getElementById(`${sectionId}Section`);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
}

// Refresh section
function refreshSection(sectionId) {
    const section = document.getElementById(`${sectionId}Section`);
    if (!section) return;
    
    section.classList.add('loading');
    
    // Simulate refresh
    setTimeout(() => {
        section.classList.remove('loading');
        updateConnectionStatus('Data refreshed', 'success');
    }, 1000);
}

// Export functions
window.initializeDashboard = initializeDashboard;
window.updateConnectionStatus = updateConnectionStatus;
window.updateWalletUI = updateWalletUI;
window.updateStatsUI = updateStatsUI;
window.updateTradingUI = updateTradingUI; 