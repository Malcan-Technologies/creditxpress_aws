'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { fetchWithTokenRefresh, TokenStorage } from '@/lib/authUtils';
import { ArrowLeftIcon, CheckCircleIcon, ShieldCheckIcon, KeyIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface PKISession {
  id: string;
  submissionId: string;
  applicationId: string;
  currentSignatory: {
    fullName: string;
    email: string;
    userId?: string;
    status: 'intercepted' | 'cert_checked' | 'otp_sent' | 'ready_to_sign' | 'signed' | 'failed';
    certificateStatus: 'checking' | 'valid' | 'expired' | 'not_found' | 'enrollment_required' | 'pending';
    otpRequested: boolean;
  };
  submissionStatus: 'in_progress' | 'completed' | 'failed';
}

function PKISigningContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get('application');
  const status = searchParams.get('status');

  const [pkiSession, setPkiSession] = useState<PKISession | null>(null);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const hasInitialized = useRef(false);
  const [step, setStep] = useState<'checking' | 'ready_to_request' | 'otp_input' | 'signing' | 'complete' | 'error'>('checking');
  const [resendingOtp, setResendingOtp] = useState(false);
  const [lastOtpRequest, setLastOtpRequest] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(0);
  const [otpAlreadySent, setOtpAlreadySent] = useState<boolean>(false);
  const otpRequestInProgress = useRef(false);
  const lastSuccessfulOtpTime = useRef<number>(0);

  // Function to request OTP manually
  const handleRequestOtp = async (source = 'unknown') => {
    const now = Date.now();
    console.log(`🔍 OTP request triggered from: ${source} at ${now}`);
    
    // FIRST: Check sessionStorage for recent OTP request (cross-instance protection)
    if (typeof window !== 'undefined' && applicationId) {
      const recentOtpKey = `recent_otp_${applicationId}`;
      const globalOtpKey = `global_recent_otp`;
      const lastOtpTime = sessionStorage.getItem(recentOtpKey);
      const lastGlobalOtpTime = sessionStorage.getItem(globalOtpKey);
      console.log(`🔍 SessionStorage check: key=${recentOtpKey}, lastTime=${lastOtpTime}, globalTime=${lastGlobalOtpTime}, appId=${applicationId}`);
      
      // Check both app-specific and global OTP timing
      if (lastOtpTime && (now - parseInt(lastOtpTime)) < 5000) {
        console.log(`🚫 OTP request blocked by app sessionStorage - sent ${now - parseInt(lastOtpTime)}ms ago`);
        return;
      }
      if (lastGlobalOtpTime && (now - parseInt(lastGlobalOtpTime)) < 3000) {
        console.log(`🚫 OTP request blocked by global sessionStorage - sent ${now - parseInt(lastGlobalOtpTime)}ms ago`);
        return;
      }
      
      // Immediately mark this request to prevent others
      sessionStorage.setItem(recentOtpKey, now.toString());
      sessionStorage.setItem(globalOtpKey, now.toString());
      console.log(`✅ SessionStorage updated: ${recentOtpKey} = ${now}, global = ${now}`);
    }
    
    // SECOND: Check time-based protection immediately
    if (lastSuccessfulOtpTime.current && (now - lastSuccessfulOtpTime.current) < 10000) {
      console.log(`🚫 OTP was sent recently (${now - lastSuccessfulOtpTime.current}ms ago), preventing duplicate request`);
      return;
    }
    
    if (!pkiSession?.currentSignatory?.userId) return;
    
    // Only allow manual button clicks, not programmatic calls during Fast Refresh
    if (source !== 'manual_button' && source !== 'resend_button') {
      console.log('🚫 OTP request blocked - not from user interaction');
      return;
    }
    
    // Prevent multiple clicks
    if (resendingOtp || otpRequestInProgress.current) {
      console.log('🚫 OTP request already in progress, ignoring click...');
      return;
    }
    
    // Set the time immediately to prevent rapid successive calls
    lastSuccessfulOtpTime.current = now;
    otpRequestInProgress.current = true;
    
    try {
      setResendingOtp(true);
      setError('');
      setSuccessMessage('');
      
      const userId = pkiSession.currentSignatory.userId;
      const userEmail = pkiSession.currentSignatory.email;
      
      console.log('📧 Requesting OTP for digital signing...');
      console.trace('OTP request call stack');
      
      const otpRequestData = await fetchWithTokenRefresh(
        "/api/pki/request-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: userId,
            email: userEmail,
            submissionId: applicationId
          }),
        }
      ) as any;
      
      console.log('🎯 OTP request response:', otpRequestData);
      
      if (!otpRequestData.success) {
        throw new Error(otpRequestData.message || 'Failed to request OTP');
      }
      
      const now = Date.now();
      setLastOtpRequest(now);
      setCountdown(30); // Start 30-second countdown
      setOtpAlreadySent(true);
      lastSuccessfulOtpTime.current = now; // Track successful OTP time
      
      // Save to session storage to prevent re-sending on refresh
      if (typeof window !== 'undefined' && applicationId) {
        const sessionKey = `pki_otp_sent_${applicationId}`;
        sessionStorage.setItem(sessionKey, now.toString());
      }
      
      // Update PKI session status
      const updatedSession = {
        ...pkiSession,
        currentSignatory: {
          ...pkiSession.currentSignatory,
          status: 'otp_sent' as const,
          otpRequested: true
        }
      };
      setPkiSession(updatedSession);
      setStep('otp_input');
      
      console.log('✅ OTP sent to:', userEmail);
      
    } catch (error) {
      console.error('❌ Failed to request OTP:', error);
      
      // Enhanced error message for OTP request
      let errorMessage = 'Failed to request OTP. Please try again.';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('certificate') && message.includes('not found')) {
          errorMessage = 'Digital certificate not found. Please ensure your certificate is enrolled.';
        } else if (message.includes('rate limit') || message.includes('too many')) {
          errorMessage = 'Too many OTP requests. Please wait before requesting again.';
        } else if (message.includes('network') || message.includes('timeout')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setResendingOtp(false);
      otpRequestInProgress.current = false;
    }
  };

  // Resend OTP handler (reuse the same logic as initial request)
  const handleResendOtp = async () => {
    await handleRequestOtp('resend_button');
    // Show success message temporarily if successful
    if (!error) {
      setSuccessMessage('OTP resent successfully! Check your email.');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  useEffect(() => {
    if (!applicationId) {
      setError('Application ID is required');
      setStep('error');
      setLoading(false);
      return;
    }

    // Initialize PKI session - either restore from storage or create new
    const initializePKISession = async () => {
      try {
        // First check if OTP was already sent for this session
        if (typeof window !== 'undefined') {
          const sessionKey = `pki_otp_sent_${applicationId}`;
          const otpSent = sessionStorage.getItem(sessionKey);
          if (otpSent) {
            console.log('🔄 PKI session found - OTP already sent, fetching real user data...');
            
            // Get real application data to restore proper user info
            const applicationData = await fetchWithTokenRefresh(
              `/api/loan-applications/${applicationId}`
            ) as any;
            
            if (!applicationData.user?.icNumber && !applicationData.user?.idNumber) {
              throw new Error('IC Number is required for PKI signing');
            }
            
            const userId = applicationData.user.icNumber || applicationData.user.idNumber;
            const userEmail = applicationData.user.email;
            const userName = applicationData.user.fullName;
            
            setOtpAlreadySent(true);
            setStep('otp_input');
            setLoading(false);
            // Restore countdown if still active
            const sentTime = parseInt(otpSent);
            const elapsed = Math.floor((Date.now() - sentTime) / 1000);
            if (elapsed < 30) {
              setCountdown(30 - elapsed);
            }
            // Create PKI session with real user data
            const restoredSession: PKISession = {
              id: `pki_${Date.now()}`,
              submissionId: applicationId!,
              applicationId: applicationId!,
              currentSignatory: {
                fullName: userName,
                email: userEmail,
                userId: userId,
                status: 'otp_sent',
                certificateStatus: 'valid',
                otpRequested: true
              },
              submissionStatus: 'in_progress'
            };
            setPkiSession(restoredSession);
            return;
          }
        }

        // If no OTP session found, prepare for OTP request (don't auto-send)
        console.log('🔐 Preparing PKI workflow', { applicationId, status });
        
        // Step 1: Get application details to extract user information
        const applicationData = await fetchWithTokenRefresh(
          `/api/loan-applications/${applicationId}`
        ) as any;
        
        if (!applicationData.user?.icNumber && !applicationData.user?.idNumber) {
          throw new Error('IC Number is required for PKI signing');
        }
        
        const userId = applicationData.user.icNumber || applicationData.user.idNumber;
        const userEmail = applicationData.user.email;
        const userName = applicationData.user.fullName;
        
        console.log('🔍 Checking certificate status for user:', userId);
        
        // Step 2: Check certificate status using GetCertInfo
        const certCheckData = await fetchWithTokenRefresh(
          `/api/mtsa/cert-info/${userId}`,
          {
            method: "GET",
          }
        ) as any;
        
        console.log('📜 Certificate check response:', certCheckData);
        
        // Create PKI session with real data (but don't send OTP yet)
        const pkiSession: PKISession = {
          id: `pki_${Date.now()}`,
          submissionId: applicationId!, // Use application ID as submission ID for now
          applicationId: applicationId!,
          currentSignatory: {
            fullName: userName,
            email: userEmail,
            userId: userId,
            status: 'cert_checked',
            certificateStatus: certCheckData.success && certCheckData.data?.certStatus === 'ACTIVE' ? 'valid' : 'pending',
            otpRequested: false
          },
          submissionStatus: 'in_progress'
        };
        
        setPkiSession(pkiSession);
        setStep('ready_to_request');
        setLoading(false);
        
        console.log('✅ PKI session prepared, ready for OTP request:', userEmail);
        
      } catch (error) {
        console.error('❌ Failed to initialize PKI workflow:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize PKI signing');
        setStep('error');
        setLoading(false);
      }
    };

    // Only run once when component mounts and has applicationId
    if (applicationId && !hasInitialized.current) {
      console.log('🚀 Initializing PKI session', { applicationId, hasInitialized: hasInitialized.current });
      hasInitialized.current = true;
      initializePKISession();
    } else {
      console.log('🔄 Skipping PKI initialization', { applicationId, hasInitialized: hasInitialized.current });
    }
  }, [applicationId]); // Remove otpAlreadySent dependency to prevent re-runs

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpSubmit = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      setSuccessMessage('');
      return;
    }

    if (!pkiSession?.currentSignatory) {
      setError('PKI session not found. Please refresh the page.');
      setSuccessMessage('');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('🔐 Submitting OTP for PKI signing', { 
        otp, 
        sessionId: pkiSession.id, 
        userId: pkiSession.currentSignatory.userId 
      });
      
      setStep('signing');
      
      // Call the orchestrator API to complete PKI signing with the OTP
      console.log('🔐 Calling orchestrator to complete PKI signing...');
      
      const signPdfResponse = await fetchWithTokenRefresh(
        "/api/pki/sign-pdf",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: pkiSession.currentSignatory.userId,
            otp: otp,
            submissionId: pkiSession.submissionId,
            applicationId: pkiSession.applicationId
          }),
        }
      ) as any;

      console.log('📄 PKI sign PDF response:', signPdfResponse);

      if (!signPdfResponse.success) {
        throw new Error(signPdfResponse.message || 'Failed to complete PKI signing');
      }
      
      setStep('complete');
      setSubmitting(false);
      
      console.log('✅ PKI signing completed successfully', { data: signPdfResponse.data });
      
      // Store signed document data in session for display
      if (typeof window !== 'undefined' && signPdfResponse.data) {
        sessionStorage.setItem('pki_signed_data', JSON.stringify(signPdfResponse.data));
      }
      
      // Clear session storage when signing is complete
      if (typeof window !== 'undefined' && applicationId) {
        const sessionKey = `pki_otp_sent_${applicationId}`;
        sessionStorage.removeItem(sessionKey);
      }
      
      // Redirect to success page after a delay (increased to allow user to see PDF option)
      setTimeout(() => {
        router.push('/dashboard/loans?tab=applications&signed=success&pki=true');
      }, 5000);
      
    } catch (error) {
      console.error('❌ PKI signing failed:', error);
      
      // Enhanced error message handling
      let errorMessage = 'PKI signing failed. Please try again.';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('invalid otp') || message.includes('ds001')) {
          errorMessage = 'Invalid or expired OTP. Please request a new OTP and try again.';
        } else if (message.includes('ds108')) {
          errorMessage = 'Certificate identity verification failed. Please ensure your certificate matches your account details.';
        } else if (message.includes('certificate') && message.includes('expired')) {
          errorMessage = 'Your digital certificate has expired. Please renew your certificate.';
        } else if (message.includes('access denied')) {
          errorMessage = 'Access denied. You can only sign with your own account.';
        } else if (message.includes('timeout') || message.includes('network')) {
          errorMessage = 'Network timeout. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      setSubmitting(false);
      setStep('otp_input'); // Go back to OTP input
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'checking':
        return (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary"></div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700">Initializing PKI Signing</h3>
              <p className="text-gray-600 mt-2">
                Checking your digital certificate and preparing secure signing...
              </p>
            </div>
          </div>
        );

      case 'ready_to_request':
        return (
          <div className="space-y-6">
            {/* Error Message Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center">
                  <XCircleIcon className="h-5 w-5 text-red-600 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-red-800 font-medium">Error</h4>
                    <p className="text-red-700 text-sm mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <KeyIcon className="h-8 w-8 text-purple-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700">Ready for PKI Signing</h3>
              <p className="text-gray-600 mt-2">
                We'll send a 6-digit OTP to <strong>{pkiSession?.currentSignatory.email}</strong> for secure document signing.
              </p>
            </div>
            
            <div className="space-y-4">
              <button 
                onClick={() => handleRequestOtp('manual_button')}
                disabled={resendingOtp}
                className="w-full px-6 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendingOtp ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending OTP...
                  </div>
                ) : (
                  'Send OTP to Email'
                )}
              </button>
            </div>
          </div>
        );

      case 'otp_input':
        return (
          <div className="space-y-6">
            {/* Success Message Display */}
            {successMessage && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-green-800 font-medium">Success</h4>
                    <p className="text-green-700 text-sm mt-1">{successMessage}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Error Message Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center">
                  <XCircleIcon className="h-5 w-5 text-red-600 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-red-800 font-medium">Error</h4>
                    <p className="text-red-700 text-sm mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <KeyIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700">Enter Your PKI OTP</h3>
              <p className="text-gray-600 mt-2">
                A 6-digit OTP has been sent to <strong>{pkiSession?.currentSignatory.email}</strong>
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-primary focus:border-transparent text-center text-lg tracking-widest text-gray-900 bg-white"
                  maxLength={6}
                  disabled={submitting}
                />
              </div>
              
              {error && (
                <div className={`border rounded-lg p-3 ${
                  error.includes('resent successfully') 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center">
                    {error.includes('resent successfully') ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2" />
                    ) : (
                      <XCircleIcon className="h-4 w-4 text-red-600 mr-2" />
                    )}
                    <p className={`text-sm ${
                      error.includes('resent successfully') 
                        ? 'text-green-700' 
                        : 'text-red-700'
                    }`}>
                      {error}
                    </p>
                  </div>
                </div>
              )}

              {/* Resend OTP option */}
              <div className="flex items-center justify-center space-x-4 text-sm">
                <span className="text-gray-600">Didn't receive the OTP?</span>
                <button
                  onClick={handleResendOtp}
                  disabled={resendingOtp || countdown > 0} // Use countdown state
                  className="text-purple-primary hover:text-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resendingOtp ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-primary mr-1"></div>
                      Resending...
                    </div>
                  ) : (
                    countdown > 0 
                      ? `Resend OTP (${countdown}s)`
                      : 'Resend OTP'
                  )}
                </button>
              </div>
              
              <button 
                onClick={handleOtpSubmit}
                disabled={submitting || otp.length !== 6}
                className="w-full px-6 py-3 bg-purple-primary text-white rounded-xl hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Verifying OTP...
                  </div>
                ) : (
                  'Complete PKI Signing'
                )}
              </button>
            </div>
          </div>
        );

      case 'signing':
        return (
          <div className="space-y-6">
            {/* Error Message Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center">
                  <XCircleIcon className="h-5 w-5 text-red-600 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-red-800 font-medium">Signing Error</h4>
                    <p className="text-red-700 text-sm mt-1">{error}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => {
                      setError('');
                      setStep('otp_input');
                      setSubmitting(false);
                    }}
                    className="text-red-700 hover:text-red-800 text-sm font-medium underline"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
            
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary"></div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-700">Signing Document</h3>
                <p className="text-gray-600 mt-2">
                  Applying your digital signature with PKI certificate... <br />
                  Please do not close this window
                </p>
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center">
              <CheckCircleIcon className="h-12 w-12 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-green-700">PKI Signing Complete!</h3>
              <p className="text-gray-600 mt-2">
                Your document has been signed successfully with PKI digital certificate.
              </p>
            </div>
            
            {/* Success Actions */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  router.push('/dashboard/loans?tab=applications&signed=success&pki=true');
                }}
                className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                Continue to Dashboard
              </button>
            </div>
            
            <p className="text-xs text-gray-500">
              Auto-redirecting in a few seconds...
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <XCircleIcon className="h-8 w-8 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-700">PKI Signing Failed</h3>
              <p className="text-gray-600 mt-2">{error}</p>
            </div>
            <button 
              onClick={() => router.push('/dashboard/loans?tab=applications')}
              className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors font-medium"
            >
              Return to Dashboard
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard/loans?tab=applications')}
            className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors font-body"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Applications
          </button>
        </div>

        {/* Main PKI Signing Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-4">
              <ShieldCheckIcon className="h-10 w-10 text-purple-primary" />
            </div>
            <h1 className="text-xl font-heading font-bold text-gray-700">
              PKI Digital Signing
            </h1>
            <p className="text-gray-600 mt-2">
              Secure document signing with digital certificate
            </p>
          </div>
          
          {loading ? (
            <div className="text-center space-y-4 py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-primary mx-auto"></div>
              <p className="text-gray-600">Loading PKI session...</p>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              {renderStep()}
            </div>
          )}

          {pkiSession && (step === 'ready_to_request' || step === 'otp_input') && (
            <div className="text-center mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Certificate Status: <span className="font-medium text-green-600">
                  {pkiSession.currentSignatory.certificateStatus === 'valid' ? 'Valid' : 'Pending'}
                </span> | 
                Session ID: {pkiSession.id.slice(-8)}
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Loading component for Suspense fallback
function PKISigningLoading() {
  return (
    <DashboardLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-4 py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-primary mx-auto"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Main export with Suspense wrapper
export default function PKISigningPage() {
  return (
    <Suspense fallback={<PKISigningLoading />}>
      <PKISigningContent />
    </Suspense>
  );
}
