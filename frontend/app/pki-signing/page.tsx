'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { fetchWithTokenRefresh } from '@/lib/authUtils';
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

export default function PKISigningPage() {
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
  const [step, setStep] = useState<'checking' | 'otp_input' | 'signing' | 'complete' | 'error'>('checking');
  const [resendingOtp, setResendingOtp] = useState(false);
  const [lastOtpRequest, setLastOtpRequest] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(0);
  const [otpAlreadySent, setOtpAlreadySent] = useState<boolean>(false);

  // Check if OTP was already sent for this session
  useEffect(() => {
    if (typeof window !== 'undefined' && applicationId) {
      const sessionKey = `pki_otp_sent_${applicationId}`;
      const otpSent = sessionStorage.getItem(sessionKey);
      if (otpSent) {
        console.log('🔄 PKI session found - OTP already sent, skipping auto-send');
        setOtpAlreadySent(true);
        setStep('otp_input');
        setLoading(false);
        // Restore countdown if still active
        const sentTime = parseInt(otpSent);
        const elapsed = Math.floor((Date.now() - sentTime) / 1000);
        if (elapsed < 30) {
          setCountdown(30 - elapsed);
        }
        // Create a mock PKI session to show the UI
        const mockSession: PKISession = {
          id: `pki_${Date.now()}`,
          submissionId: applicationId!,
          applicationId: applicationId!,
          currentSignatory: {
            fullName: 'User',
            email: 'user@example.com',
            userId: '891114075601',
            status: 'otp_sent',
            certificateStatus: 'valid',
            otpRequested: true
          },
          submissionStatus: 'in_progress'
        };
        setPkiSession(mockSession);
      }
    }
  }, [applicationId]);

  // Reusable function to request OTP
  const requestOtp = async (userId: string, userEmail: string) => {
    console.log('📧 Requesting OTP for digital signing...');
    
    const otpRequestData = await fetchWithTokenRefresh(
      "/api/mtsa/request-otp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId,
          usage: "DS", // Digital Signing
          emailAddress: userEmail,
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
    
    // Save to session storage to prevent re-sending on refresh
    if (typeof window !== 'undefined' && applicationId) {
      const sessionKey = `pki_otp_sent_${applicationId}`;
      sessionStorage.setItem(sessionKey, now.toString());
    }
    
    return otpRequestData;
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (!pkiSession?.currentSignatory?.userId) return;
    
    try {
      setResendingOtp(true);
      setError('');
      setSuccessMessage('');
      
      // Get current user data
      const applicationData = await fetchWithTokenRefresh(
        `/api/loan-applications/${applicationId}`
      ) as any;
      
      const userId = applicationData.user.icNumber || applicationData.user.idNumber;
      const userEmail = applicationData.user.email;
      
      await requestOtp(userId, userEmail);
      
      // Show success message temporarily
      setSuccessMessage('OTP resent successfully! Check your email.');
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      console.error('❌ Failed to resend OTP:', error);
      
      // Enhanced error message for resend OTP
      let errorMessage = 'Failed to resend OTP. Please try again.';
      
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
    }
  };

  useEffect(() => {
    if (!applicationId) {
      setError('Application ID is required');
      setStep('error');
      setLoading(false);
      return;
    }

    // Poll for PKI session status
    const pollSession = async () => {
      try {
        // TODO: Implement actual API call to get PKI session
        // For now, simulate the PKI workflow
        
        console.log('🔐 PKI Signing Page loaded', { applicationId, status });
        
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
        
        // Step 3: Request OTP with DS (Digital Signing) usage
        const otpRequestData = await requestOtp(userId, userEmail);
        
        // Create PKI session with real data
        const pkiSession: PKISession = {
          id: `pki_${Date.now()}`,
          submissionId: applicationId!, // Use application ID as submission ID for now
          applicationId: applicationId!,
          currentSignatory: {
            fullName: userName,
            email: userEmail,
            userId: userId,
            status: 'otp_sent',
            certificateStatus: certCheckData.success && certCheckData.data?.certStatus === 'ACTIVE' ? 'valid' : 'pending',
            otpRequested: true
          },
          submissionStatus: 'in_progress'
        };
        
        setPkiSession(pkiSession);
        setStep('otp_input');
        setLoading(false);
        
        console.log('✅ PKI session created, OTP sent to:', userEmail);
        
      } catch (error) {
        console.error('❌ Failed to initialize PKI workflow:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize PKI signing');
        setStep('error');
        setLoading(false);
      }
    };

    // Only run once when component mounts and has applicationId
    // AND only if OTP hasn't been sent already for this session
    if (applicationId && !hasInitialized.current && !otpAlreadySent) {
      hasInitialized.current = true;
      pollSession();
    }
  }, [otpAlreadySent]); // Include otpAlreadySent to check if OTP was already sent

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
      
      console.log('✅ PKI signing completed successfully');
      
      // Clear session storage when signing is complete
      if (typeof window !== 'undefined' && applicationId) {
        const sessionKey = `pki_otp_sent_${applicationId}`;
        sessionStorage.removeItem(sessionKey);
      }
      
      // Redirect to success page after a delay
      setTimeout(() => {
        router.push('/dashboard/loans?tab=applications&signed=success&pki=true');
      }, 3000);
      
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
                  Applying your digital signature with PKI certificate...
                </p>
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-700">PKI Signing Complete!</h3>
              <p className="text-gray-600 mt-2">
                Your document has been signed successfully with PKI digital certificate.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Redirecting you back to your dashboard...
              </p>
            </div>
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

          {pkiSession && step === 'otp_input' && (
            <div className="text-center mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Certificate Status: <span className="font-medium text-green-600">Valid</span> | 
                Session ID: {pkiSession.id.slice(-8)}
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
