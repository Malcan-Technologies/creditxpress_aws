'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '../../../components/AdminLayout';
import { 
  ShieldCheckIcon, 
  DocumentTextIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  UserIcon,
  ClockIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { fetchWithAdminTokenRefresh } from '../../../../lib/authUtils';

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  icNumber?: string;
  role: string;
}

interface CertificateStatus {
  hasValidCert: boolean;
  message: string;
  certificateData?: any;
  nextStep: 'kyc' | 'certificate' | 'enrollment' | 'complete';
}

interface KycSession {
  id: string;
  status: string;
  ctosOnboardingUrl?: string;
  ctosStatus?: number;
  ctosResult?: number;
}

interface OrganisationInfo {
  orgName: string;
  orgUserDesignation: string;
  orgUserRegistrationNo: string;
  orgUserRegistrationType: 'P' | 'E';
  orgAddress: string;
  orgAddressCity: string;
  orgAddressState: string;
  orgAddressPostcode: string;
  orgAddressCountry: string;
  orgRegistationNo: string; // Note: keeping the typo as per MTSA API
  orgRegistationType: 'NTRMY' | 'IRB' | 'RMC' | 'CIDB' | 'BAM' | 'GOV' | 'GOVSUB' | 'INT' | 'LEI';
  orgPhoneNo: string;
  orgFaxNo?: string;
}

export default function AdminSigningSettingsPage() {
  const router = useRouter();
  
  // User and certificate state
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Certificate check state
  const [certificateStatus, setCertificateStatus] = useState<CertificateStatus | null>(null);
  const [checkingCertificate, setCheckingCertificate] = useState(false);
  
  // IC Number input state
  const [showIcInput, setShowIcInput] = useState(false);
  const [icNumber, setIcNumber] = useState('');
  const [updatingIc, setUpdatingIc] = useState(false);
  
  // KYC state
  const [kycSession, setKycSession] = useState<KycSession | null>(null);
  const [kycInProgress, setKycInProgress] = useState(false);
  const [kycCompleted, setKycCompleted] = useState(false);
  const [ctosOnboardingUrl, setCtosOnboardingUrl] = useState<string | null>(null);
  const [pollingKycId, setPollingKycId] = useState<string | null>(null);
  
  // PIN and Organisation state
  const [showPinStep, setShowPinStep] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [organisationInfo, setOrganisationInfo] = useState<OrganisationInfo>({
    orgName: '',
    orgUserDesignation: '',
    orgUserRegistrationNo: '',
    orgUserRegistrationType: 'E',
    orgAddress: '',
    orgAddressCity: '',
    orgAddressState: '',
    orgAddressPostcode: '',
    orgAddressCountry: 'MY',
    orgRegistationNo: '',
    orgRegistationType: 'NTRMY',
    orgPhoneNo: '',
    orgFaxNo: ''
  });
  const [submittingCertificate, setSubmittingCertificate] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
  }, []);


  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const userData = await fetchWithAdminTokenRefresh<AdminUser>('/api/admin/me');
      setCurrentUser(userData);
      
      // Auto-start certificate check if IC number exists
      if (userData.icNumber) {
        await checkCertificate(userData.icNumber);
      } else {
        setShowIcInput(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  };

  const checkCertificate = async (userId: string) => {
    try {
      setCheckingCertificate(true);
      setError(null);
      
      console.log('Checking certificate status for admin user:', userId);
      
      const response = await fetchWithAdminTokenRefresh<any>(
        `/api/admin/mtsa/cert-info/${userId}`
      );
      
      console.log('Certificate check response:', response);
      
      if (response.success && response.data?.certStatus === 'Valid') {
        setCertificateStatus({
          hasValidCert: true,
          message: 'You have a valid digital certificate for signing documents.',
          certificateData: response.data,
          nextStep: 'complete'
        });
      } else {
        // Check if user already has approved KYC before showing KYC step
        console.log('Checking existing KYC status for admin user...');
        
        try {
          const kycStatusResponse = await fetchWithAdminTokenRefresh<any>('/api/admin/kyc/status');
          
          console.log('KYC status response:', kycStatusResponse);
          
          if (kycStatusResponse.success && kycStatusResponse.isAlreadyApproved) {
            setCertificateStatus({
              hasValidCert: false,
              message: 'KYC verification completed. You can now proceed to certificate enrollment.',
              nextStep: 'enrollment'
            });
            setKycCompleted(true);
          } else {
            setCertificateStatus({
              hasValidCert: false,
              message: 'No valid digital certificate found. You need to complete KYC verification and certificate enrollment.',
              nextStep: 'kyc'
            });
          }
        } catch (kycError) {
          console.error('KYC status check error:', kycError);
          setCertificateStatus({
            hasValidCert: false,
            message: 'No valid digital certificate found. You need to complete KYC verification and certificate enrollment.',
            nextStep: 'kyc'
          });
        }
      }
    } catch (err) {
      console.error('Certificate check error:', err);
      setCertificateStatus({
        hasValidCert: false,
        message: err instanceof Error ? err.message : 'Failed to check certificate status',
        nextStep: 'kyc'
      });
    } finally {
      setCheckingCertificate(false);
    }
  };

  const updateIcNumber = async () => {
    if (!icNumber.trim()) {
      setError('Please enter your IC number');
      return;
    }

    // Validate IC number format (Malaysian IC: 12 digits)
    const icPattern = /^\d{12}$/;
    if (!icPattern.test(icNumber)) {
      setError('Please enter a valid IC number (12 digits)');
      return;
    }

    try {
      setUpdatingIc(true);
      setError(null);

      // Update admin user IC number
      await fetchWithAdminTokenRefresh('/api/admin/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          icNumber: icNumber.trim(),
        }),
      });

      // Update current user state
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          icNumber: icNumber.trim(),
        });
      }

      // Hide IC input and start certificate check
      setShowIcInput(false);
      await checkCertificate(icNumber.trim());

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update IC number');
    } finally {
      setUpdatingIc(false);
    }
  };

  const handleStartKyc = async () => {
    if (!currentUser?.icNumber) {
      setError('IC number is required for KYC verification');
      return;
    }

    try {
      setKycInProgress(true);
      setError(null);
      
      // Check if user already has approved KYC before starting new one
      console.log('Checking existing KYC status before starting new KYC...');
      const kycStatusResponse = await fetchWithAdminTokenRefresh<any>('/api/admin/kyc/status');
      
      if (kycStatusResponse.success && kycStatusResponse.isAlreadyApproved) {
        setKycCompleted(true);
        setCertificateStatus({
          hasValidCert: false,
          message: 'KYC verification already completed. You can proceed to certificate enrollment.',
          nextStep: 'enrollment'
        });
        setKycInProgress(false);
        return;
      }
      
      console.log('Starting KYC for admin user:', currentUser.icNumber);
      
      const response = await fetchWithAdminTokenRefresh<any>('/api/admin/kyc/start-ctos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentName: currentUser.fullName,
          documentNumber: currentUser.icNumber,
          platform: 'web'
        }),
      });

      if (response.success) {
        const kycData = {
          id: response.kycId,
          ctosOnboardingUrl: response.onboardingUrl,
          ctosOnboardingId: response.onboardingId,
          status: 'IN_PROGRESS'
        };
        
        setKycSession(kycData);
        
        if (response.onboardingUrl) {
          setCtosOnboardingUrl(response.onboardingUrl);
          setPollingKycId(response.kycId);
          
          // Open CTOS eKYC in new tab
          window.open(response.onboardingUrl, '_blank');
          
          // Start polling for status updates
          startKycStatusPolling(response.kycId);
        }
      } else {
        throw new Error(response.message || 'Failed to start KYC verification');
      }
    } catch (err) {
      console.error('KYC start error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start KYC verification');
    } finally {
      setKycInProgress(false);
    }
  };

  const startKycStatusPolling = (kycId: string) => {
    const pollStatus = async () => {
      try {
        const statusResponse = await fetchWithAdminTokenRefresh<any>(
          `/api/admin/kyc/status/${kycId}`
        );

        if (statusResponse.success && statusResponse.data) {
          const kycData = statusResponse.data;
          setKycSession(kycData);

          if (kycData.ctosStatus === 2) { // Completed
            setKycCompleted(true);
            setKycInProgress(false);
            setCtosOnboardingUrl(null);
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error('KYC status polling error:', err);
      }
    };

    const pollInterval = setInterval(pollStatus, 3000);
    
    // Clean up after 30 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setCtosOnboardingUrl(null);
      setPollingKycId(null);
    }, 30 * 60 * 1000);
  };

  const handleAcceptKyc = async () => {
    if (!kycSession || (kycSession.ctosResult !== 1)) {
      setError('KYC verification not approved');
      return;
    }

    // Proceed to PIN and organisation step
    setShowPinStep(true);
    setKycCompleted(false);
  };

  const validatePin = () => {
    if (!pin || pin.length !== 6) {
      setError('Please enter a 6-digit PIN');
      return false;
    }

    if (!/^\d{6}$/.test(pin)) {
      setError('PIN must contain only numbers');
      return false;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return false;
    }

    return true;
  };

  const validateOrganisationInfo = () => {
    const required = [
      'orgName', 'orgUserDesignation', 'orgUserRegistrationNo', 
      'orgAddress', 'orgAddressCity', 'orgAddressState', 
      'orgAddressPostcode', 'orgRegistationNo', 'orgPhoneNo'
    ];

    for (const field of required) {
      if (!organisationInfo[field as keyof OrganisationInfo]) {
        setError(`Please fill in ${field.replace('org', '').replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`);
        return false;
      }
    }

    // Validate postcode
    if (!/^\d{5}$/.test(organisationInfo.orgAddressPostcode)) {
      setError('Postcode must be 5 digits');
      return false;
    }

    // Validate phone number format
    if (!/^\+?[\d\s-()]+$/.test(organisationInfo.orgPhoneNo)) {
      setError('Please enter a valid phone number');
      return false;
    }

    return true;
  };

  const handleCertificateEnrollment = async () => {
    if (!validatePin() || !validateOrganisationInfo()) {
      return;
    }

    if (!currentUser?.icNumber) {
      setError('IC number is required for certificate enrollment');
      return;
    }

    try {
      setSubmittingCertificate(true);
      setError(null);

      console.log('Requesting certificate enrollment for admin user:', currentUser.icNumber);

      // Get KYC images
      const kycResponse = await fetchWithAdminTokenRefresh<any>('/api/admin/kyc/images');

      if (!kycResponse.images) {
        throw new Error('KYC documents not found. Please complete KYC verification first.');
      }

      const { front, back, selfie } = kycResponse.images;
      
      if (!front?.url || !back?.url || !selfie?.url) {
        throw new Error('Required KYC documents not found. Please complete KYC verification first.');
      }

      // Request certificate with userType = 2 for internal users
      const certificateResponse = await fetchWithAdminTokenRefresh<any>('/api/admin/mtsa/request-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.icNumber,
          fullName: currentUser.fullName,
          emailAddress: currentUser.email,
          mobileNo: currentUser.phoneNumber,
          nationality: 'MY',
          userType: '2', // Internal user type
          idType: 'N',
          authFactor: pin, // Use PIN instead of OTP
          nricFrontUrl: front.url,
          nricBackUrl: back.url,
          selfieImageUrl: selfie.url,
          organisationInfo, // Add organisation info for internal users
          verificationData: {
            verifyStatus: 'Approved',
            verifyDatetime: new Date().toISOString().replace('T', ' ').substring(0, 19), // Format: yyyy-MM-dd HH:mm:ss
            verifyVerifier: 'CTOS',
            verifyMethod: 'e-KYC'
          },
        }),
      });

      console.log('Certificate enrollment response:', certificateResponse);

      if (certificateResponse.success) {
        // Success - refresh certificate status
        await checkCertificate(currentUser.icNumber);
        setShowPinStep(false);
        setPin('');
        setConfirmPin('');
      } else {
        throw new Error(certificateResponse.message || 'Certificate enrollment failed');
      }
    } catch (err) {
      console.error('Certificate enrollment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to enroll certificate');
    } finally {
      setSubmittingCertificate(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading signing settings...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Digital Signing Settings</h1>
          <p className="text-gray-400">Manage your digital certificate for document signing</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
            <div className="flex items-center">
              <XCircleIcon className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-400">{error}</span>
            </div>
          </div>
        )}

        {/* User Info Card */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
          <div className="flex items-center mb-4">
            <UserIcon className="h-6 w-6 text-purple-400 mr-3" />
            <h2 className="text-xl font-semibold text-white">User Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Name:</span>
              <span className="text-white ml-2">{currentUser?.fullName}</span>
            </div>
            <div>
              <span className="text-gray-400">Email:</span>
              <span className="text-white ml-2">{currentUser?.email}</span>
            </div>
            <div>
              <span className="text-gray-400">Phone:</span>
              <span className="text-white ml-2">{currentUser?.phoneNumber}</span>
            </div>
            <div>
              <span className="text-gray-400">IC Number:</span>
              <span className="text-white ml-2">{currentUser?.icNumber || 'Not set'}</span>
            </div>
          </div>
        </div>

        {/* IC Number Input */}
        {showIcInput && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">IC Number Required</h3>
            <p className="text-gray-400 mb-4">
              Please enter your IC number to proceed with certificate verification.
            </p>
            
            <div className="flex gap-4">
              <input
                type="text"
                value={icNumber}
                onChange={(e) => setIcNumber(e.target.value)}
                placeholder="Enter 12-digit IC number"
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                maxLength={12}
              />
              <button
                onClick={updateIcNumber}
                disabled={updatingIc}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingIc ? 'Updating...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Certificate Status */}
        {certificateStatus && !showIcInput && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
            <div className="flex items-center mb-4">
              <ShieldCheckIcon className="h-6 w-6 text-purple-400 mr-3" />
              <h2 className="text-xl font-semibold text-white">Certificate Status</h2>
              {checkingCertificate && (
                <div className="ml-auto">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
                </div>
              )}
            </div>

            <div className={`p-4 rounded-lg border ${
              certificateStatus.hasValidCert 
                ? 'bg-green-900/20 border-green-700' 
                : 'bg-yellow-900/20 border-yellow-700'
            }`}>
              <div className="flex items-center">
                {certificateStatus.hasValidCert ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
                ) : (
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
                )}
                <span className={certificateStatus.hasValidCert ? 'text-green-400' : 'text-yellow-400'}>
                  {certificateStatus.message}
                </span>
              </div>
            </div>

            {/* Certificate Details */}
            {certificateStatus.hasValidCert && certificateStatus.certificateData && (
              <div className="mt-4 p-4 bg-gray-700 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2">Certificate Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">Status:</span>
                    <span className="text-green-400 ml-2">{certificateStatus.certificateData.certStatus}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Serial Number:</span>
                    <span className="text-white ml-2">{certificateStatus.certificateData.certSerialNo}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {certificateStatus && !showIcInput && !checkingCertificate && (
          <div className="space-y-4">
            {/* KYC Step */}
            {certificateStatus.nextStep === 'kyc' && !showPinStep && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center mb-4">
                  <DocumentTextIcon className="h-6 w-6 text-purple-400 mr-3" />
                  <h3 className="text-lg font-semibold text-white">Step 1: KYC Verification</h3>
                </div>
                
                <p className="text-gray-400 mb-4">
                  Complete KYC verification to proceed with certificate enrollment.
                </p>

                {/* KYC Status */}
                {kycSession && (
                  <div className="mb-4">
                    {ctosOnboardingUrl && (
                      <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg mb-4">
                        <div className="flex items-center mb-2">
                          <ClockIcon className="h-5 w-5 text-blue-400 mr-2" />
                          <span className="text-blue-400">KYC verification in progress...</span>
                        </div>
                        <a
                          href={ctosOnboardingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Continue KYC Verification
                          <ArrowRightIcon className="h-4 w-4 ml-2" />
                        </a>
                      </div>
                    )}

                    {kycCompleted && kycSession.ctosResult === 1 && (
                      <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg mb-4">
                        <div className="flex items-center mb-2">
                          <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
                          <span className="text-green-400">KYC verification completed successfully!</span>
                        </div>
                        <button
                          onClick={handleAcceptKyc}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Proceed to Certificate Enrollment
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!kycSession && (
                  <button
                    onClick={handleStartKyc}
                    disabled={kycInProgress}
                    className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {kycInProgress ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Starting KYC...
                      </>
                    ) : (
                      <>
                        Start KYC Verification
                        <ArrowRightIcon className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* PIN and Organisation Step */}
            {showPinStep && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center mb-4">
                  <ShieldCheckIcon className="h-6 w-6 text-purple-400 mr-3" />
                  <h3 className="text-lg font-semibold text-white">Step 2: Certificate Enrollment</h3>
                </div>
                
                <p className="text-gray-400 mb-6">
                  Set a 6-digit PIN and provide organisation information to complete certificate enrollment.
                </p>

                <div className="space-y-6">
                  {/* PIN Section */}
                  <div className="space-y-4">
                    <h4 className="text-white font-medium">Security PIN</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Enter 6-digit PIN</label>
                        <input
                          type="password"
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="••••••"
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-lg tracking-widest"
                          maxLength={6}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Confirm PIN</label>
                        <input
                          type="password"
                          value={confirmPin}
                          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="••••••"
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-lg tracking-widest"
                          maxLength={6}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Organisation Information Section */}
                  <div className="space-y-4">
                    <h4 className="text-white font-medium">Organisation Information</h4>
                    
                    {/* Organisation Name and User Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Organisation Name *</label>
                        <input
                          type="text"
                          value={organisationInfo.orgName}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgName: e.target.value})}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Enter organisation name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Your Designation *</label>
                        <input
                          type="text"
                          value={organisationInfo.orgUserDesignation}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgUserDesignation: e.target.value})}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="e.g., Director, Manager"
                        />
                      </div>
                    </div>

                    {/* User Registration Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Registration Number *</label>
                        <input
                          type="text"
                          value={organisationInfo.orgUserRegistrationNo}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgUserRegistrationNo: e.target.value})}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Professional/Employee ID"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Registration Type *</label>
                        <select
                          value={organisationInfo.orgUserRegistrationType}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgUserRegistrationType: e.target.value as 'P' | 'E'})}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="E">Employee ID</option>
                          <option value="P">Professional Registration</option>
                        </select>
                      </div>
                    </div>

                    {/* Organisation Address */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Organisation Address *</label>
                      <textarea
                        value={organisationInfo.orgAddress}
                        onChange={(e) => setOrganisationInfo({...organisationInfo, orgAddress: e.target.value})}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter full address"
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">City *</label>
                        <input
                          type="text"
                          value={organisationInfo.orgAddressCity}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgAddressCity: e.target.value})}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">State *</label>
                        <input
                          type="text"
                          value={organisationInfo.orgAddressState}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgAddressState: e.target.value})}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Postcode *</label>
                        <input
                          type="text"
                          value={organisationInfo.orgAddressPostcode}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgAddressPostcode: e.target.value.replace(/\D/g, '').slice(0, 5)})}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          maxLength={5}
                        />
                      </div>
                    </div>

                    {/* Organisation Registration */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Organisation Registration No *</label>
                        <input
                          type="text"
                          value={organisationInfo.orgRegistationNo}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgRegistationNo: e.target.value})}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Company registration number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Registration Type *</label>
                        <select
                          value={organisationInfo.orgRegistationType}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgRegistationType: e.target.value as any})}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="NTRMY">Malaysia Trade Register</option>
                          <option value="IRB">Inland Revenue Board</option>
                          <option value="RMC">Royal Malaysia Customs</option>
                          <option value="CIDB">Construction Industry Development Board</option>
                          <option value="BAM">Board of Architects Malaysia</option>
                          <option value="GOV">Government Entity</option>
                          <option value="GOVSUB">Government Subdivision</option>
                          <option value="INT">International Organization</option>
                          <option value="LEI">LEI Registration</option>
                        </select>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Phone Number *</label>
                        <input
                          type="text"
                          value={organisationInfo.orgPhoneNo}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgPhoneNo: e.target.value})}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="+60123456789"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Fax Number (Optional)</label>
                        <input
                          type="text"
                          value={organisationInfo.orgFaxNo}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgFaxNo: e.target.value})}
                          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="+60312345678"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleCertificateEnrollment}
                      disabled={submittingCertificate || pin.length !== 6 || confirmPin.length !== 6}
                      className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {submittingCertificate ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                          Enrolling Certificate...
                        </>
                      ) : (
                        'Enroll Certificate'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Certificate Enrollment Step */}
            {certificateStatus.nextStep === 'enrollment' && !showPinStep && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center mb-4">
                  <ShieldCheckIcon className="h-6 w-6 text-purple-400 mr-3" />
                  <h3 className="text-lg font-semibold text-white">Step 2: Certificate Enrollment</h3>
                </div>
                
                <p className="text-gray-400 mb-6">
                  KYC verification completed successfully. You can now enroll for your digital certificate.
                </p>

                <button
                  onClick={() => setShowPinStep(true)}
                  className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Start Certificate Enrollment
                  <ArrowRightIcon className="h-4 w-4 ml-2" />
                </button>
              </div>
            )}

            {/* Complete Status */}
            {certificateStatus.nextStep === 'complete' && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center mb-4">
                  <CheckCircleIcon className="h-6 w-6 text-green-400 mr-3" />
                  <h3 className="text-lg font-semibold text-white">Certificate Ready</h3>
                </div>
                
                <p className="text-gray-400 mb-4">
                  Your digital certificate is active and ready for document signing.
                </p>

                <div className="flex gap-4">
                  <button
                    onClick={() => checkCertificate(currentUser?.icNumber!)}
                    disabled={checkingCertificate}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                  >
                    {checkingCertificate ? 'Refreshing...' : 'Refresh Status'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
