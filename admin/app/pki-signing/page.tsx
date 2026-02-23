'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminLayout from '../components/AdminLayout';
import { fetchWithAdminTokenRefresh } from '@/lib/authUtils';
import { ArrowLeftIcon, CheckCircleIcon, ShieldCheckIcon, KeyIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface PKISession {
  id: string;
  submissionId: string;
  applicationId: string;
  currentSignatory: {
    fullName: string;
    email: string;
    userId?: string;
    status: 'intercepted' | 'cert_checked' | 'pin_ready' | 'ready_to_sign' | 'signed' | 'failed';
    certificateStatus: 'checking' | 'valid' | 'expired' | 'not_found' | 'enrollment_required' | 'pending';
    pinRequested: boolean;
  };
  submissionStatus: 'in_progress' | 'completed' | 'failed';
  signatoryType: 'COMPANY' | 'WITNESS';
}

function AdminPKISigningContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get('application');
  const signatoryType = searchParams.get('signatory')?.trim().toUpperCase() as 'COMPANY' | 'WITNESS' | undefined;
  const isSupportedSignatory = signatoryType === 'COMPANY' || signatoryType === 'WITNESS';

  const [pkiSession, setPkiSession] = useState<PKISession | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const hasInitialized = useRef(false);
  const [step, setStep] = useState<'checking' | 'ready_to_request' | 'pin_input' | 'signing' | 'complete' | 'error'>('checking');

  // Initialize PKI session
  useEffect(() => {
    if (hasInitialized.current) return;

    if (!applicationId || !isSupportedSignatory) {
      setError('Invalid signing context. Only company and witness can sign in admin portal.');
      setStep('error');
      setLoading(false);
      hasInitialized.current = true;
      return;
    }
    
    hasInitialized.current = true;
    initializePKISession();
  }, [applicationId, isSupportedSignatory]);

  const initializePKISession = async () => {
    try {
      setLoading(true);
      setError('');

      // For now, we'll create a mock session since DocuSeal signing is already done
      // In a full implementation, this would check the signing orchestrator for the session
      setPkiSession({
        id: `admin_${applicationId}_${signatoryType}`,
        submissionId: '',
        applicationId: applicationId!,
        currentSignatory: {
          fullName: signatoryType === 'COMPANY' ? 'Company Representative' : 'Legal Witness',
          email: signatoryType === 'COMPANY' ? 'admin@kredit.my' : 'legal@kredit.my',
          status: 'pin_ready',
          certificateStatus: 'valid',
          pinRequested: true
        },
        submissionStatus: 'in_progress',
        signatoryType: signatoryType as 'COMPANY' | 'WITNESS'
      });

      setStep('pin_input');
    } catch (error) {
      console.error('Failed to initialize PKI session:', error);
      setError('Failed to initialize PKI session. Please try again.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async () => {
    if (!pin || pin.length !== 8 || !pkiSession || !isSupportedSignatory) return;

    setSubmitting(true);
    setError('');
    setStep('signing');

    try {

      const response = await fetchWithAdminTokenRefresh<{
        success: boolean;
        message: string;
        allSigned?: boolean;
        newStatus?: string;
      }>('/api/admin/applications/pin-sign', {
        method: 'POST',
        body: JSON.stringify({
          applicationId,
          pin,
          signatoryType
        })
      });

      if (response?.success) {
		setStep('complete');
		setSuccessMessage(response.message || 'Document signed successfully!');
		
		// Auto-redirect after 3 seconds
		setTimeout(() => {
		  // Determine appropriate tab and filter based on the new status
		  const isAllSigned = response.allSigned;
		  const newStatus = response.newStatus;
		  
		  // If all signatures are done, redirect to stamping tab, otherwise stay on signatures
		  if (isAllSigned || newStatus === 'PENDING_STAMPING') {
			router.push(`/dashboard/applications?application=${applicationId}&tab=stamping&filter=pending-stamping`);
		  } else {
			router.push(`/dashboard/applications?application=${applicationId}&tab=signatures`);
		  }
		}, 3000);
	  } else {
        setError(response?.message || 'Failed to sign document');
        setStep('pin_input');
      }
    } catch (error: any) {
      console.error('PIN signing error:', error);
      setError(error.message || 'Failed to sign document');
      setStep('pin_input');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoBack = () => {
    router.push('/dashboard/applications?tab=signatures');
  };

  if (loading) {
    return (
      <AdminLayout title="PKI Digital Signing" description="Complete your digital signature">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="PKI Digital Signing" description="Complete your digital signature">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleGoBack}
            className="inline-flex items-center text-blue-400 hover:text-blue-300 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Applications
          </button>
          
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-600/20 mb-4">
              <ShieldCheckIcon className="h-6 w-6 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              PKI Digital Signing
            </h1>
            <p className="text-gray-300">
              Complete your digital signature as {signatoryType?.toLowerCase()} representative
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-600 font-medium">✓ DocuSeal Completed</span>
            <span className={step === 'complete' ? 'text-green-600 font-medium' : 'text-gray-400'}>
              {step === 'complete' ? '✓' : '○'} PKI Signing
            </span>
          </div>
          <div className="mt-2 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: step === 'complete' ? '100%' : '50%' }}
            />
          </div>
        </div>

        {/* Content based on step */}
        {step === 'pin_input' && (
          <div className="bg-gray-800/50 rounded-lg shadow-sm border border-gray-700/30 p-6">
            <div className="text-center mb-6">
              <KeyIcon className="mx-auto h-12 w-12 text-blue-400 mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Enter Your PIN
              </h2>
              <p className="text-gray-300">
                Enter your 8-digit PIN to complete PKI digital signing
              </p>
            </div>

            {error && (
              <div className="mb-4 bg-red-700/30 border border-red-600/30 text-red-300 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-gray-300 mb-2">
                  8-Digit PIN
                </label>
                <input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                    setPin(value);
                  }}
                  placeholder="Enter 8-digit PIN"
                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  maxLength={8}
                  disabled={submitting}
                />
                <p className="mt-1 text-sm text-gray-400">
                  Your PIN must be exactly 8 digits
                </p>
              </div>

              <button
                onClick={handlePinSubmit}
                disabled={pin.length !== 8 || submitting}
                className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing...
                  </>
                ) : (
                  <>
                    <ShieldCheckIcon className="h-4 w-4 mr-2" />
                    Complete PKI Signing
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'signing' && (
          <div className="bg-gray-800/50 rounded-lg shadow-sm border border-gray-700/30 p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Signing Document...
            </h2>
            <p className="text-gray-300">
              Please wait while we complete your PKI digital signature
            </p>
          </div>
        )}

        {step === 'complete' && (
          <div className="bg-gray-800/50 rounded-lg shadow-sm border border-gray-700/30 p-6 text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-400 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Signing Complete!
            </h2>
            <p className="text-gray-300 mb-4">
              {successMessage}
            </p>
            <p className="text-sm text-gray-400">
              Redirecting you back to applications...
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="bg-gray-800/50 rounded-lg shadow-sm border border-gray-700/30 p-6 text-center">
            <XCircleIcon className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Signing Failed
            </h2>
            <p className="text-gray-300 mb-4">
              {error}
            </p>
            <button
              onClick={handleGoBack}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Back to Applications
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default function AdminPKISigningPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminPKISigningContent />
    </Suspense>
  );
}
