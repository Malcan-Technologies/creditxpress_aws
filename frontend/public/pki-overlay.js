/**
 * PKI Signing Overlay for DocuSeal Integration
 * This script injects an OTP input overlay into DocuSeal pages for PKI signing
 */

(function() {
  'use strict';
  
  console.log('🔐 PKI Overlay Script Loaded');
  
  // Configuration
  const PKI_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' 
      ? 'http://localhost:4001' 
      : 'https://api.kredit.my',
    checkInterval: 2000, // Check for PKI session every 2 seconds
    otpLength: 6,
    sessionTimeout: 600000 // 10 minutes
  };
  
  // Global state
  let pkiSession = null;
  let checkTimer = null;
  let overlayElement = null;
  
  /**
   * Initialize PKI overlay system
   */
  function initializePKIOverlay() {
    console.log('🔐 Initializing PKI overlay system');
    
    // Start checking for PKI sessions
    startSessionPolling();
    
    // Listen for PKI events from backend
    setupEventListeners();
    
    // Override DocuSeal form submission if needed
    interceptDocuSealSubmission();
  }
  
  /**
   * Start polling for PKI sessions
   */
  function startSessionPolling() {
    if (checkTimer) {
      clearInterval(checkTimer);
    }
    
    checkTimer = setInterval(async () => {
      await checkForPKISession();
    }, PKI_CONFIG.checkInterval);
    
    // Initial check
    checkForPKISession();
  }
  
  /**
   * Check if there's an active PKI session for current user
   */
  async function checkForPKISession() {
    try {
      // Extract submission ID from URL or page
      const submissionId = extractSubmissionId();
      if (!submissionId) {
        return;
      }
      
      // Check if there's a PKI session waiting for this submission
      const response = await fetch(`${PKI_CONFIG.backendUrl}/api/pki/check-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ submissionId })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data && result.data.status === 'awaiting_otp') {
          console.log('🔐 PKI session found, showing OTP overlay');
          showOTPOverlay(result.data);
        }
      }
    } catch (error) {
      console.warn('PKI session check failed:', error);
    }
  }
  
  /**
   * Show OTP input overlay
   */
  function showOTPOverlay(session) {
    if (overlayElement) {
      return; // Already showing
    }
    
    pkiSession = session;
    
    // Create overlay HTML
    overlayElement = document.createElement('div');
    overlayElement.className = 'pki-otp-overlay';
    overlayElement.innerHTML = `
      <div class="pki-overlay-backdrop">
        <div class="pki-overlay-content">
          <div class="pki-header">
            <h3>🔐 Digital Certificate Signing</h3>
            <p>An OTP has been sent to your registered email address</p>
          </div>
          
          <div class="pki-form">
            <div class="pki-input-group">
              <label for="pki-otp-input">Enter 6-digit OTP:</label>
              <input 
                type="text" 
                id="pki-otp-input" 
                class="pki-otp-input"
                placeholder="000000" 
                maxlength="6"
                autocomplete="off"
              >
            </div>
            
            <div class="pki-timer">
              <span id="pki-timer-text">OTP expires in: <span id="pki-countdown">10:00</span></span>
            </div>
            
            <div class="pki-buttons">
              <button id="pki-sign-btn" class="pki-btn pki-btn-primary" disabled>
                Complete Signing
              </button>
              <button id="pki-resend-btn" class="pki-btn pki-btn-secondary">
                Resend OTP
              </button>
              <button id="pki-cancel-btn" class="pki-btn pki-btn-cancel">
                Cancel
              </button>
            </div>
            
            <div id="pki-status" class="pki-status"></div>
          </div>
        </div>
      </div>
    `;
    
    // Add styles
    addPKIStyles();
    
    // Append to body
    document.body.appendChild(overlayElement);
    
    // Setup event listeners
    setupOverlayEventListeners();
    
    // Start countdown timer
    startCountdownTimer();
    
    // Focus on input
    setTimeout(() => {
      const input = document.getElementById('pki-otp-input');
      if (input) {
        input.focus();
      }
    }, 100);
  }
  
  /**
   * Setup overlay event listeners
   */
  function setupOverlayEventListeners() {
    const otpInput = document.getElementById('pki-otp-input');
    const signBtn = document.getElementById('pki-sign-btn');
    const resendBtn = document.getElementById('pki-resend-btn');
    const cancelBtn = document.getElementById('pki-cancel-btn');
    
    // OTP input validation
    if (otpInput) {
      otpInput.addEventListener('input', (e) => {
        const value = e.target.value.replace(/\D/g, ''); // Only digits
        e.target.value = value;
        
        // Enable sign button when OTP is complete
        if (signBtn) {
          signBtn.disabled = value.length !== PKI_CONFIG.otpLength;
        }
      });
      
      // Submit on Enter
      otpInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && otpInput.value.length === PKI_CONFIG.otpLength) {
          completePKISigning();
        }
      });
    }
    
    // Sign button
    if (signBtn) {
      signBtn.addEventListener('click', completePKISigning);
    }
    
    // Resend button
    if (resendBtn) {
      resendBtn.addEventListener('click', resendOTP);
    }
    
    // Cancel button
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeOverlay);
    }
    
    // Close on backdrop click
    const backdrop = document.querySelector('.pki-overlay-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          closeOverlay();
        }
      });
    }
  }
  
  /**
   * Complete PKI signing with OTP
   */
  async function completePKISigning() {
    const otpInput = document.getElementById('pki-otp-input');
    const signBtn = document.getElementById('pki-sign-btn');
    const statusDiv = document.getElementById('pki-status');
    
    if (!otpInput || !pkiSession) {
      return;
    }
    
    const otp = otpInput.value;
    
    if (otp.length !== PKI_CONFIG.otpLength) {
      showStatus('Please enter a valid 6-digit OTP', 'error');
      return;
    }
    
    try {
      // Disable button and show loading
      if (signBtn) {
        signBtn.disabled = true;
        signBtn.textContent = 'Signing...';
      }
      
      showStatus('Processing PKI signature...', 'info');
      
      const response = await fetch(`${PKI_CONFIG.backendUrl}/api/pki/complete-signing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          sessionId: pkiSession.id,
          otp: otp
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showStatus('Document signed successfully with PKI certificate!', 'success');
        
        // Close overlay after short delay
        setTimeout(() => {
          closeOverlay();
          
          // Refresh page to show signed document
          window.location.reload();
        }, 2000);
        
      } else {
        showStatus(result.message || 'PKI signing failed', 'error');
        
        // Re-enable button
        if (signBtn) {
          signBtn.disabled = false;
          signBtn.textContent = 'Complete Signing';
        }
      }
      
    } catch (error) {
      console.error('PKI signing error:', error);
      showStatus('Network error. Please try again.', 'error');
      
      // Re-enable button
      if (signBtn) {
        signBtn.disabled = false;
        signBtn.textContent = 'Complete Signing';
      }
    }
  }
  
  /**
   * Resend OTP
   */
  async function resendOTP() {
    const resendBtn = document.getElementById('pki-resend-btn');
    
    try {
      if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.textContent = 'Sending...';
      }
      
      showStatus('Sending new OTP...', 'info');
      
      // Extract user info for OTP request
      const userId = getCurrentUserId();
      const email = getCurrentUserEmail();
      
      const response = await fetch(`${PKI_CONFIG.backendUrl}/api/pki/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          userId: userId,
          email: email,
          submissionId: pkiSession?.submissionId
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showStatus('New OTP sent to your email', 'success');
        
        // Reset countdown
        startCountdownTimer();
      } else {
        showStatus(result.message || 'Failed to send OTP', 'error');
      }
      
    } catch (error) {
      console.error('OTP resend error:', error);
      showStatus('Failed to resend OTP', 'error');
    } finally {
      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend OTP';
      }
    }
  }
  
  /**
   * Show status message
   */
  function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('pki-status');
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    statusDiv.className = `pki-status pki-status-${type}`;
    
    // Clear after 5 seconds for non-error messages
    if (type !== 'error') {
      setTimeout(() => {
        if (statusDiv.textContent === message) {
          statusDiv.textContent = '';
          statusDiv.className = 'pki-status';
        }
      }, 5000);
    }
  }
  
  /**
   * Start countdown timer
   */
  function startCountdownTimer() {
    const countdownElement = document.getElementById('pki-countdown');
    if (!countdownElement) return;
    
    let timeLeft = 600; // 10 minutes in seconds
    
    const timer = setInterval(() => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      
      countdownElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      timeLeft--;
      
      if (timeLeft < 0) {
        clearInterval(timer);
        showStatus('OTP has expired. Please request a new one.', 'error');
        
        // Disable sign button
        const signBtn = document.getElementById('pki-sign-btn');
        if (signBtn) {
          signBtn.disabled = true;
        }
      }
    }, 1000);
  }
  
  /**
   * Close overlay
   */
  function closeOverlay() {
    if (overlayElement) {
      overlayElement.remove();
      overlayElement = null;
    }
    
    pkiSession = null;
    
    // Clear any timers
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }
  }
  
  /**
   * Add PKI styles to page
   */
  function addPKIStyles() {
    if (document.getElementById('pki-styles')) {
      return; // Already added
    }
    
    const style = document.createElement('style');
    style.id = 'pki-styles';
    style.textContent = `
      .pki-otp-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .pki-overlay-backdrop {
        background: rgba(0, 0, 0, 0.7);
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      
      .pki-overlay-content {
        background: white;
        border-radius: 12px;
        padding: 32px;
        max-width: 480px;
        width: 100%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        animation: pkiSlideIn 0.3s ease-out;
      }
      
      @keyframes pkiSlideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      .pki-header {
        text-align: center;
        margin-bottom: 24px;
      }
      
      .pki-header h3 {
        margin: 0 0 8px 0;
        font-size: 24px;
        font-weight: 600;
        color: #1f2937;
      }
      
      .pki-header p {
        margin: 0;
        color: #6b7280;
        font-size: 16px;
      }
      
      .pki-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      .pki-input-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .pki-input-group label {
        font-weight: 500;
        color: #374151;
        font-size: 14px;
      }
      
      .pki-otp-input {
        padding: 12px 16px;
        border: 2px solid #d1d5db;
        border-radius: 8px;
        font-size: 18px;
        font-weight: 600;
        text-align: center;
        letter-spacing: 4px;
        font-family: 'Courier New', monospace;
        transition: border-color 0.2s;
      }
      
      .pki-otp-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      .pki-timer {
        text-align: center;
        padding: 12px;
        background: #f3f4f6;
        border-radius: 8px;
        font-size: 14px;
        color: #6b7280;
      }
      
      .pki-buttons {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .pki-btn {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .pki-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      
      .pki-btn-primary {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white;
      }
      
      .pki-btn-primary:hover:not(:disabled) {
        background: linear-gradient(135deg, #2563eb, #1e40af);
        transform: translateY(-1px);
      }
      
      .pki-btn-secondary {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #d1d5db;
      }
      
      .pki-btn-secondary:hover:not(:disabled) {
        background: #e5e7eb;
      }
      
      .pki-btn-cancel {
        background: #fee2e2;
        color: #dc2626;
        border: 1px solid #fecaca;
      }
      
      .pki-btn-cancel:hover:not(:disabled) {
        background: #fecaca;
      }
      
      .pki-status {
        padding: 12px;
        border-radius: 8px;
        font-size: 14px;
        text-align: center;
        min-height: 20px;
      }
      
      .pki-status-info {
        background: #dbeafe;
        color: #1e40af;
        border: 1px solid #bfdbfe;
      }
      
      .pki-status-success {
        background: #dcfce7;
        color: #166534;
        border: 1px solid #bbf7d0;
      }
      
      .pki-status-error {
        background: #fee2e2;
        color: #dc2626;
        border: 1px solid #fecaca;
      }
      
      @media (max-width: 640px) {
        .pki-overlay-content {
          padding: 24px;
          margin: 20px;
        }
        
        .pki-header h3 {
          font-size: 20px;
        }
        
        .pki-otp-input {
          font-size: 16px;
        }
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Setup general event listeners
   */
  function setupEventListeners() {
    // Listen for PKI events from backend (if using WebSocket or SSE)
    // For now, we'll rely on polling
  }
  
  /**
   * Intercept DocuSeal form submission for PKI workflow
   */
  function interceptDocuSealSubmission() {
    // This would override DocuSeal's native submission
    // For now, we'll rely on backend webhook interception
    console.log('🔐 PKI submission interception ready');
  }
  
  /**
   * Utility functions
   */
  function extractSubmissionId() {
    // Try to extract from URL
    const urlMatch = window.location.pathname.match(/\/s\/([^\/]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    
    // Try to extract from page elements
    const submissionElement = document.querySelector('[data-submission-id]');
    if (submissionElement) {
      return submissionElement.getAttribute('data-submission-id');
    }
    
    return null;
  }
  
  function getAuthToken() {
    // Try to get from localStorage first
    return localStorage.getItem('authToken') || 
           localStorage.getItem('token') ||
           sessionStorage.getItem('authToken') ||
           sessionStorage.getItem('token') ||
           '';
  }
  
  function getCurrentUserId() {
    // Extract from token or localStorage
    try {
      const token = getAuthToken();
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId || payload.sub || payload.id;
      }
    } catch (e) {
      // Ignore token parsing errors
    }
    
    return localStorage.getItem('userId') || '';
  }
  
  function getCurrentUserEmail() {
    // Extract from token or localStorage
    try {
      const token = getAuthToken();
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.email;
      }
    } catch (e) {
      // Ignore token parsing errors
    }
    
    return localStorage.getItem('userEmail') || '';
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePKIOverlay);
  } else {
    initializePKIOverlay();
  }
  
  // Expose global functions for testing
  window.PKIOverlay = {
    showOTPOverlay,
    closeOverlay,
    completePKISigning,
    resendOTP
  };
  
})();
