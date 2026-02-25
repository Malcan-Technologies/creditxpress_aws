'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import { fetchWithAdminTokenRefresh } from '../../../../lib/authUtils';
import { toast } from 'sonner';

// Shadcn UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Lucide Icons
import {
  ShieldCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  User,
  Clock,
  XCircle,
  Pencil,
  X,
  RefreshCw,
  Plus,
  Search,
  KeyRound,
  Loader2,
  Users,
  HelpCircle,
} from 'lucide-react';

import { Tooltip } from '@/components/ui/tooltip';

// Types
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
  certificateData?: {
    certStatus: string;
    certSerialNo: string;
    validFrom: string;
    validTo: string;
    subject?: string; // Subject DN from certificate
  };
  nextStep: 'kyc' | 'certificate' | 'enrollment' | 'complete' | 'verify-type';
  isExternalCert?: boolean; // True if user has external cert (needs internal enrollment)
  isInternalCert?: boolean; // True if cert has EMP- serial (internal user)
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
  orgUserRegistrationType: 'PAS' | 'IDC';
  orgAddress: string;
  orgAddressCity: string;
  orgAddressState: string;
  orgAddressPostcode: string;
  orgAddressCountry: string;
  orgRegistationNo: string;
  orgRegistationType: 'NTRMY' | 'IRB' | 'RMC' | 'CIDB' | 'BAM' | 'GOV' | 'GOVSUB' | 'INT' | 'LEI';
  orgPhoneNo: string;
  orgFaxNo?: string;
}

interface InternalSigner {
  id: string;
  icNumber: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  signerRole: string;
  certSerialNo?: string;
  certStatus?: string;
  certValidFrom?: string;
  certValidTo?: string;
  lastCertCheck?: string;
  status: string;
  pinVerifiedAt?: string;
  enrolledAt?: string;
  enrolledBy?: string;
  notes?: string;
  createdAt: string;
}

// Helper function to get status badge variant
function getStatusBadgeVariant(status: string): "default" | "success" | "warning" | "destructive" | "info" {
  switch (status) {
    case 'VERIFIED': return 'success';
    case 'PENDING': return 'warning';
    case 'EXPIRED': return 'destructive';
    case 'REVOKED': return 'destructive';
    case 'INACTIVE': return 'default';
    default: return 'default';
  }
}

export default function AdminSigningSettingsPage() {
  // User and certificate state
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('my-certificate');
  
  // Profile editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editIcNumber, setEditIcNumber] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  
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
  
  // PIN and Organisation state
  const [showPinStep, setShowPinStep] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [organisationInfo, setOrganisationInfo] = useState<OrganisationInfo>({
    orgName: '',
    orgUserDesignation: '',
    orgUserRegistrationNo: '',
    orgUserRegistrationType: 'IDC',
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

  // Dialog states
  const [showVerifyPinDialog, setShowVerifyPinDialog] = useState(false);
  const [showResetPinDialog, setShowResetPinDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showAddSignerDialog, setShowAddSignerDialog] = useState(false);
  const [showSignerPinDialog, setShowSignerPinDialog] = useState(false);

  // PIN verification state
  const [verificationPin, setVerificationPin] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [pinVerificationResult, setPinVerificationResult] = useState<{ success: boolean; message: string } | null>(null);

  // PIN reset state
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [resettingPin, setResettingPin] = useState(false);
  const [pinResetResult, setPinResetResult] = useState<{ success: boolean; message: string } | null>(null);

  // Revoke certificate state
  const [revokeReason, setRevokeReason] = useState('keyCompromise');
  const [revokeBy, setRevokeBy] = useState('Self');
  const [revokeOtp, setRevokeOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [revokingCertificate, setRevokingCertificate] = useState(false);

  // Internal Signers state
  const [internalSigners, setInternalSigners] = useState<InternalSigner[]>([]);
  const [loadingSigners, setLoadingSigners] = useState(false);
  const [refreshingSigners, setRefreshingSigners] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  // Add signer state
  const [lookupIcNumber, setLookupIcNumber] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    userInfo?: { fullName: string; email: string; phoneNumber: string };
    certificateInfo?: { certStatus: string; certSerialNo: string; certValidFrom: string; certValidTo: string; subject?: string; isInternalCert?: boolean };
    hasCertificate: boolean;
    alreadyExists: boolean;
    isInternalCert?: boolean;
  } | null>(null);
  const [newSignerName, setNewSignerName] = useState('');
  const [newSignerEmail, setNewSignerEmail] = useState('');
  const [newSignerRole, setNewSignerRole] = useState('ATTESTOR');
  const [addingSigner, setAddingSigner] = useState(false);

  // Signer PIN verification
  const [selectedSigner, setSelectedSigner] = useState<InternalSigner | null>(null);
  const [signerPin, setSignerPin] = useState('');
  const [verifyingSignerPin, setVerifyingSignerPin] = useState(false);

  const fetchCurrentUser = useCallback(async () => {
    try {
      setLoading(true);
      const userData = await fetchWithAdminTokenRefresh<AdminUser>('/api/admin/me');
      setCurrentUser(userData);
      setEditFullName(userData.fullName || '');
      setEditIcNumber(userData.icNumber || '');
      
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
  }, []);

  const fetchInternalSigners = useCallback(async () => {
    try {
      setLoadingSigners(true);
      let url = '/api/admin/internal-signers';
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (roleFilter) params.append('signerRole', roleFilter);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await fetchWithAdminTokenRefresh<{ success: boolean; data: InternalSigner[] }>(url);
      if (response.success) {
        setInternalSigners(response.data);
      }
    } catch (err) {
      console.error('Error fetching internal signers:', err);
    } finally {
      setLoadingSigners(false);
    }
  }, [statusFilter, roleFilter]);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (activeTab === 'internal-signers') {
      fetchInternalSigners();
    }
  }, [activeTab, fetchInternalSigners]);

  const checkCertificate = async (userId: string) => {
    try {
      setCheckingCertificate(true);
      setError(null);
      
      const response = await fetchWithAdminTokenRefresh<{ success: boolean; data?: { certStatus: string; certSerialNo: string; validFrom: string; validTo: string; subject?: string } }>(
        `/api/admin/mtsa/cert-info/${userId}`
      );
      
      if (response.success && response.data?.certStatus === 'Valid') {
        // PIN format is the same for all internal certs regardless of SERIALNUMBER format
        // Always show verify-type so user can verify PIN; if it works = internal, if not = external
        setCertificateStatus({
          hasValidCert: true,
          message: 'A valid certificate was found. Verify your 8-digit PIN to confirm it is an internal signing certificate.',
          certificateData: response.data,
          nextStep: 'verify-type',
          isInternalCert: false,
          isExternalCert: undefined
        });
      } else {
        try {
          const kycStatusResponse = await fetchWithAdminTokenRefresh<{ success: boolean; isAlreadyApproved?: boolean }>('/api/admin/kyc/status');
          
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
        } catch {
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

  const handleSaveProfile = async () => {
    if (!editFullName.trim()) {
      setError('Name is required');
      return;
    }
    if (editIcNumber && !/^\d{12}$/.test(editIcNumber)) {
      setError('IC number must be 12 digits');
      return;
    }

    try {
      setSavingProfile(true);
      setError(null);

      await fetchWithAdminTokenRefresh('/api/admin/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editFullName.trim(),
          icNumber: editIcNumber.trim() || undefined,
        }),
      });

      setCurrentUser(prev => prev ? {
        ...prev,
        fullName: editFullName.trim(),
        icNumber: editIcNumber.trim() || prev.icNumber,
      } : null);

      setIsEditingProfile(false);
      toast.success('Profile updated successfully');
      
      if (editIcNumber && editIcNumber !== currentUser?.icNumber) {
        await checkCertificate(editIcNumber);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const updateIcNumber = async () => {
    if (!icNumber.trim() || !/^\d{12}$/.test(icNumber)) {
      setError('Please enter a valid IC number (12 digits)');
      return;
    }

    try {
      setUpdatingIc(true);
      setError(null);

      await fetchWithAdminTokenRefresh('/api/admin/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icNumber: icNumber.trim() }),
      });

      setCurrentUser(prev => prev ? { ...prev, icNumber: icNumber.trim() } : null);
      setShowIcInput(false);
      toast.success('IC number updated successfully');
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

      const kycStatusResponse = await fetchWithAdminTokenRefresh<{ success: boolean; isAlreadyApproved?: boolean }>('/api/admin/kyc/status');
      
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
      
      const response = await fetchWithAdminTokenRefresh<{ success: boolean; kycId: string; onboardingUrl: string; onboardingId: string; message?: string }>('/api/admin/kyc/start-ctos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: currentUser.fullName,
          documentNumber: currentUser.icNumber,
          platform: 'web'
        }),
      });

      if (response.success && response.onboardingUrl) {
        setKycSession({ id: response.kycId, status: 'IN_PROGRESS', ctosOnboardingUrl: response.onboardingUrl });
        setCtosOnboardingUrl(response.onboardingUrl);
        window.open(response.onboardingUrl, '_blank');
        startKycStatusPolling(response.kycId);
      } else {
        throw new Error(response.message || 'Failed to start KYC verification');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start KYC verification');
    } finally {
      setKycInProgress(false);
    }
  };

  const startKycStatusPolling = (kycId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await fetchWithAdminTokenRefresh<{ success: boolean; data?: KycSession }>(`/api/admin/kyc/status/${kycId}`);
        if (statusResponse.success && statusResponse.data) {
          setKycSession(statusResponse.data);
          if (statusResponse.data.ctosStatus === 2) {
            setKycCompleted(true);
            setCtosOnboardingUrl(null);
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error('KYC status polling error:', err);
      }
    }, 3000);
    
    setTimeout(() => clearInterval(pollInterval), 30 * 60 * 1000);
  };

  const handleAcceptKyc = async () => {
    if (!kycSession || kycSession.ctosResult !== 1) {
      setError('KYC verification not approved');
      return;
    }
    setShowPinStep(true);
    setKycCompleted(false);
  };

  const validatePin = () => {
    if (!pin || !/^\d{8}$/.test(pin)) {
      setError('Please enter an 8-digit PIN');
      return false;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return false;
    }
    return true;
  };

  const validateOrganisationInfo = () => {
    const required = ['orgName', 'orgUserDesignation', 'orgUserRegistrationNo', 'orgAddress', 'orgAddressCity', 'orgAddressState', 'orgAddressPostcode', 'orgRegistationNo', 'orgPhoneNo'];
    for (const field of required) {
      if (!organisationInfo[field as keyof OrganisationInfo]) {
        setError(`Please fill in ${field.replace('org', '').replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`);
        return false;
      }
    }
    if (!/^\d{5}$/.test(organisationInfo.orgAddressPostcode)) {
      setError('Postcode must be 5 digits');
      return false;
    }
    return true;
  };

  const handleCertificateEnrollment = async () => {
    if (!validatePin() || !validateOrganisationInfo()) return;
    if (!currentUser?.icNumber) {
      setError('IC number is required for certificate enrollment');
      return;
    }

    try {
      setSubmittingCertificate(true);
      setError(null);

      const kycResponse = await fetchWithAdminTokenRefresh<{ images?: { front?: { url: string }; back?: { url: string }; selfie?: { url: string } } }>('/api/admin/kyc/images');
      if (!kycResponse.images?.front?.url || !kycResponse.images?.back?.url || !kycResponse.images?.selfie?.url) {
        throw new Error('KYC documents not found. Please complete KYC verification first.');
      }

      const certificateResponse = await fetchWithAdminTokenRefresh<{ success: boolean; message?: string }>('/api/admin/mtsa/request-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.icNumber,
          fullName: currentUser.fullName,
          emailAddress: currentUser.email,
          mobileNo: currentUser.phoneNumber,
          nationality: 'MY',
          userType: '2',
          idType: 'N',
          authFactor: pin,
          nricFrontUrl: kycResponse.images.front.url,
          nricBackUrl: kycResponse.images.back.url,
          selfieImageUrl: kycResponse.images.selfie.url,
          organisationInfo,
          verificationData: {
            verifyStatus: 'Approved',
            verifyDatetime: new Date().toISOString().replace('T', ' ').substring(0, 19),
            verifyVerifier: 'CTOS',
            verifyMethod: 'e-KYC'
          },
        }),
      });

      if (certificateResponse.success) {
        await checkCertificate(currentUser.icNumber);
        setShowPinStep(false);
        setPin('');
        setConfirmPin('');
        // Add self to Internal Signers if not already there (so they appear in the list)
        let addedToSigners = false;
        try {
          const lookupRes = await fetchWithAdminTokenRefresh<{ success: boolean; alreadyExists: boolean }>(
            `/api/admin/internal-signers/lookup/${currentUser.icNumber.replace(/[\s-]/g, '')}`
          );
          if (lookupRes.success && !lookupRes.alreadyExists && currentUser.fullName && currentUser.email) {
            const signerRole = (currentUser.role === 'ADMIN' || currentUser.role === 'ATTESTOR') ? currentUser.role : 'ATTESTOR';
            await fetchWithAdminTokenRefresh('/api/admin/internal-signers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                icNumber: currentUser.icNumber.replace(/[\s-]/g, ''),
                fullName: currentUser.fullName,
                email: currentUser.email,
                phoneNumber: currentUser.phoneNumber || undefined,
                signerRole,
              }),
            });
            addedToSigners = true;
            fetchInternalSigners(); // Refresh list so new signer appears
          }
        } catch (addErr) {
          console.warn('Could not auto-add to internal signers:', addErr);
        }
        toast.success(
          addedToSigners
            ? 'Certificate enrolled successfully. You have been added to Internal Signers.'
            : 'Certificate enrolled successfully.'
        );
      } else {
        throw new Error(certificateResponse.message || 'Certificate enrollment failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll certificate');
    } finally {
      setSubmittingCertificate(false);
    }
  };

  const handleVerifyPin = async () => {
    if (!currentUser?.icNumber || !certificateStatus?.certificateData?.certSerialNo) {
      setError('Certificate information is required');
      return;
    }
    if (!/^\d{8}$/.test(verificationPin)) {
      setError('Please enter a valid 8-digit PIN');
      return;
    }

    try {
      setVerifyingPin(true);
      setPinVerificationResult(null);

      const response = await fetchWithAdminTokenRefresh<{ success: boolean; message?: string }>('/api/admin/mtsa/verify-cert-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.icNumber,
          certSerialNo: certificateStatus.certificateData.certSerialNo,
          certPin: verificationPin,
        }),
      });

      setPinVerificationResult({
        success: response.success,
        message: response.success ? 'PIN verified successfully!' : (response.message || 'PIN verification failed')
      });
      if (response.success) setVerificationPin('');
    } catch (err) {
      setPinVerificationResult({ success: false, message: 'Failed to verify PIN' });
    } finally {
      setVerifyingPin(false);
    }
  };

  // Verify if certificate is internal (has PIN) or external (uses OTP)
  const handleVerifyCertificateType = async () => {
    if (!currentUser?.icNumber || !certificateStatus?.certificateData?.certSerialNo) {
      setError('Certificate information is required');
      return;
    }
    if (!/^\d{8}$/.test(verificationPin)) {
      setError('Please enter a valid 8-digit PIN');
      return;
    }

    try {
      setVerifyingPin(true);
      setError(null);

      const response = await fetchWithAdminTokenRefresh<{ success: boolean; message?: string }>('/api/admin/mtsa/verify-cert-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.icNumber,
          certSerialNo: certificateStatus.certificateData.certSerialNo,
          certPin: verificationPin,
        }),
      });

      if (response.success) {
        // PIN verified - this is an internal certificate, mark as complete
        setCertificateStatus({
          ...certificateStatus,
          message: 'You have a valid internal signing certificate.',
          nextStep: 'complete',
          isExternalCert: false
        });
        setVerificationPin('');
      } else {
        // PIN failed - this is likely an external certificate
        setCertificateStatus({
          ...certificateStatus,
          message: 'Your existing certificate is an external (borrower) certificate that uses email OTP. To sign as an internal user (admin/attestor/witness), you need to enroll for an internal certificate with PIN authentication.',
          nextStep: 'kyc',
          isExternalCert: true
        });
        setVerificationPin('');
      }
    } catch (err) {
      // Error could mean external cert or connection issue
      setCertificateStatus({
        ...certificateStatus,
        message: 'Could not verify PIN. If you have an external certificate, you need to enroll for an internal certificate.',
        nextStep: 'kyc',
        isExternalCert: true
      });
      setVerificationPin('');
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleResetPin = async () => {
    if (!currentUser?.icNumber || !certificateStatus?.certificateData?.certSerialNo) {
      setError('Certificate information is required');
      return;
    }
    if (!/^\d{8}$/.test(newPin)) {
      setError('New PIN must be 8 digits');
      return;
    }
    if (newPin !== confirmNewPin) {
      setError('PINs do not match');
      return;
    }

    try {
      setResettingPin(true);
      setPinResetResult(null);

      const response = await fetchWithAdminTokenRefresh<{ success: boolean; message?: string }>('/api/admin/mtsa/reset-cert-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.icNumber,
          certSerialNo: certificateStatus.certificateData.certSerialNo,
          newPin: newPin,
        }),
      });

      setPinResetResult({
        success: response.success,
        message: response.success ? 'PIN reset successfully!' : (response.message || 'PIN reset failed')
      });
      if (response.success) {
        setNewPin('');
        setConfirmNewPin('');
      }
    } catch (err) {
      setPinResetResult({ success: false, message: 'Failed to reset PIN' });
    } finally {
      setResettingPin(false);
    }
  };

  const handleRequestOtpForRevoke = async () => {
    if (!currentUser?.email) return;

    try {
      setRequestingOtp(true);
      const response = await fetchWithAdminTokenRefresh<{ success: boolean; message?: string }>('/api/admin/mtsa/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.icNumber,
          usage: 'DS',
          emailAddress: currentUser.email,
        }),
      });

      if (response.success) {
        setOtpRequested(true);
        toast.success('OTP sent to your email');
      } else {
        throw new Error(response.message || 'Failed to request OTP');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request OTP');
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleRevokeCertificate = async () => {
    if (!currentUser?.icNumber || !certificateStatus?.certificateData?.certSerialNo) return;
    if (!/^\d{6}$/.test(revokeOtp)) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setRevokingCertificate(true);
      setError(null);

      const kycResponse = await fetchWithAdminTokenRefresh<{ images?: { front?: { url: string }; back?: { url: string } } }>('/api/admin/kyc/images');
      if (!kycResponse.images?.front?.url || !kycResponse.images?.back?.url) {
        throw new Error('KYC documents not found.');
      }

      const revokeResponse = await fetchWithAdminTokenRefresh<{ success: boolean; message?: string }>('/api/admin/mtsa/revoke-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.icNumber,
          certSerialNo: certificateStatus.certificateData.certSerialNo,
          revokeReason,
          revokeBy,
          authFactor: revokeOtp,
          idType: 'N',
          nricFrontUrl: kycResponse.images.front.url,
          nricBackUrl: kycResponse.images.back.url,
        }),
      });

      if (revokeResponse.success) {
        await checkCertificate(currentUser.icNumber);
        setShowRevokeDialog(false);
        setRevokeOtp('');
        setOtpRequested(false);
        toast.success('Certificate revoked successfully');
      } else {
        throw new Error(revokeResponse.message || 'Certificate revocation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke certificate');
    } finally {
      setRevokingCertificate(false);
    }
  };

  // Internal Signers functions
  const handleLookupIc = async () => {
    if (!/^\d{12}$/.test(lookupIcNumber)) {
      setError('Please enter a valid 12-digit IC number');
      return;
    }

    try {
      setLookingUp(true);
      setError(null);
      setLookupResult(null);

      const response = await fetchWithAdminTokenRefresh<{
        success: boolean;
        alreadyExists: boolean;
        userInfo?: { fullName: string; email: string; phoneNumber: string };
        certificateInfo?: { certStatus: string; certSerialNo: string; certValidFrom: string; certValidTo: string };
        hasCertificate: boolean;
        message?: string;
      }>(`/api/admin/internal-signers/lookup/${lookupIcNumber}`);

      if (response.success) {
        setLookupResult(response);
        if (response.userInfo) {
          setNewSignerName(response.userInfo.fullName || '');
          setNewSignerEmail(response.userInfo.email || '');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLookingUp(false);
    }
  };

  const handleAddSigner = async () => {
    if (!newSignerName || !newSignerEmail) {
      setError('Name and email are required');
      return;
    }

    try {
      setAddingSigner(true);
      setError(null);

      const response = await fetchWithAdminTokenRefresh<{ success: boolean; message?: string }>('/api/admin/internal-signers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icNumber: lookupIcNumber,
          fullName: newSignerName,
          email: newSignerEmail,
          signerRole: newSignerRole,
          certSerialNo: lookupResult?.certificateInfo?.certSerialNo,
          certStatus: lookupResult?.certificateInfo?.certStatus,
          certValidFrom: lookupResult?.certificateInfo?.certValidFrom,
          certValidTo: lookupResult?.certificateInfo?.certValidTo,
        }),
      });

      if (response.success) {
        setShowAddSignerDialog(false);
        setLookupIcNumber('');
        setLookupResult(null);
        setNewSignerName('');
        setNewSignerEmail('');
        toast.success('Signer added successfully');
        fetchInternalSigners();
      } else {
        throw new Error(response.message || 'Failed to add signer');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add signer');
    } finally {
      setAddingSigner(false);
    }
  };

  const handleVerifySignerPin = async () => {
    if (!selectedSigner || !/^\d{8}$/.test(signerPin)) {
      setError('Please enter a valid 8-digit PIN');
      return;
    }

    try {
      setVerifyingSignerPin(true);
      setError(null);

      const response = await fetchWithAdminTokenRefresh<{ success: boolean; message?: string }>(`/api/admin/internal-signers/${selectedSigner.id}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: signerPin }),
      });

      if (response.success) {
        setShowSignerPinDialog(false);
        setSignerPin('');
        setSelectedSigner(null);
        toast.success('PIN verified successfully');
        fetchInternalSigners();
      } else {
        setError(response.message || 'PIN verification failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify PIN');
    } finally {
      setVerifyingSignerPin(false);
    }
  };

  const handleRefreshSigners = async () => {
    try {
      setRefreshingSigners(true);
      await fetchWithAdminTokenRefresh('/api/admin/internal-signers/refresh', { method: 'POST' });
      await fetchInternalSigners();
    } catch (err) {
      console.error('Error refreshing signers:', err);
    } finally {
      setRefreshingSigners(false);
    }
  };

  const handleDeleteSigner = async (id: string) => {
    if (!confirm('Are you sure you want to remove this signer?')) return;

    try {
      await fetchWithAdminTokenRefresh(`/api/admin/internal-signers/${id}`, { method: 'DELETE' });
      toast.success('Signer removed successfully');
      fetchInternalSigners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove signer');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-400">Loading signing settings...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-medium text-white mb-2">Digital Signing Settings</h1>
          <p className="text-gray-400">Manage your digital certificate and internal signers</p>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="my-certificate" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              My Certificate
            </TabsTrigger>
            <TabsTrigger value="internal-signers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Internal Signers
            </TabsTrigger>
          </TabsList>

          {/* My Certificate Tab */}
          <TabsContent value="my-certificate" className="space-y-6">
            {/* User Profile Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-400" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>Your identity for digital signing</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (isEditingProfile) {
                      setEditFullName(currentUser?.fullName || '');
                      setEditIcNumber(currentUser?.icNumber || '');
                    }
                    setIsEditingProfile(!isEditingProfile);
                  }}
                >
                  {isEditingProfile ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                </Button>
              </CardHeader>
              <CardContent>
                {isEditingProfile ? (
                  <div className="space-y-4">
                    {certificateStatus?.hasValidCert && (
                      <Alert variant="warning">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Changing your name or IC number may require certificate re-enrollment.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          placeholder="Enter full name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>IC Number</Label>
                        <Input
                          value={editIcNumber}
                          onChange={(e) => setEditIcNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                          placeholder="12-digit IC number"
                          maxLength={12}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveProfile} disabled={savingProfile}>
                        {savingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditingProfile(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
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
                )}
              </CardContent>
            </Card>

            {/* IC Number Input */}
            {showIcInput && (
              <Card>
                <CardHeader>
                  <CardTitle>IC Number Required</CardTitle>
                  <CardDescription>Please enter your IC number to proceed with certificate verification.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Input
                      value={icNumber}
                      onChange={(e) => setIcNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="Enter 12-digit IC number"
                      maxLength={12}
                      className="flex-1"
                    />
                    <Button onClick={updateIcNumber} disabled={updatingIc}>
                      {updatingIc && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Certificate Status */}
            {certificateStatus && !showIcInput && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-blue-400" />
                    Certificate Status
                    {checkingCertificate && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant={certificateStatus.hasValidCert ? 'success' : 'warning'}>
                    {certificateStatus.hasValidCert ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <AlertDescription>{certificateStatus.message}</AlertDescription>
                  </Alert>

                  {certificateStatus.hasValidCert && certificateStatus.certificateData && (
                    <div className="p-4 bg-gray-800 rounded-lg">
                      <h4 className="text-sm font-medium text-white mb-3">Certificate Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-400">Status:</span>
                          <Badge variant="success" className="ml-2">{certificateStatus.certificateData.certStatus}</Badge>
                        </div>
                        <div>
                          <span className="text-gray-400">Type:</span>
                          {certificateStatus.isInternalCert ? (
                            <Badge variant="default" className="ml-2 bg-blue-600">Internal (PIN)</Badge>
                          ) : (
                            <Badge variant="secondary" className="ml-2">External (OTP)</Badge>
                          )}
                        </div>
                        <div>
                          <span className="text-gray-400">Serial Number:</span>
                          <span className="text-white ml-2 font-mono text-xs">{certificateStatus.certificateData.certSerialNo}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Valid From:</span>
                          <span className="text-white ml-2">{certificateStatus.certificateData.validFrom}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Valid To:</span>
                          <span className="text-white ml-2">{certificateStatus.certificateData.validTo}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Action Buttons for Complete Status */}
            {certificateStatus?.nextStep === 'complete' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    Certificate Management
                    {certificateStatus.isInternalCert && (
                      <Badge variant="default" className="ml-2 bg-blue-600">Internal</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {certificateStatus.isInternalCert 
                      ? 'Your internal signing certificate is active. Use your 8-digit PIN when signing documents.'
                      : 'Your digital certificate is active and ready for signing.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => checkCertificate(currentUser?.icNumber!)} disabled={checkingCertificate}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${checkingCertificate ? 'animate-spin' : ''}`} />
                      Refresh Status
                    </Button>
                    <Button onClick={() => { setShowVerifyPinDialog(true); setPinVerificationResult(null); setVerificationPin(''); }}>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Verify PIN
                    </Button>
                    <Button variant="secondary" onClick={() => { setShowResetPinDialog(true); setPinResetResult(null); setNewPin(''); setConfirmNewPin(''); }}>
                      <KeyRound className="h-4 w-4 mr-2" />
                      Reset PIN
                    </Button>
                    <Button variant="destructive" onClick={() => { setShowRevokeDialog(true); setOtpRequested(false); setRevokeOtp(''); }}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Revoke Certificate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Verify Certificate Type Step - Check if internal or external cert */}
            {certificateStatus?.nextStep === 'verify-type' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-400" />
                    Verify Your PIN
                  </CardTitle>
                  <CardDescription>
                    {certificateStatus.isInternalCert 
                      ? 'Internal signing certificate detected. Enter your 8-digit PIN to complete setup.'
                      : 'A valid certificate was found. Enter your 8-digit PIN to verify it is an internal signing certificate.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {certificateStatus.isInternalCert ? (
                    <Alert variant="success">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        Your certificate is registered as an internal signing certificate (Employee ID detected).
                        Please verify your PIN to activate signing capabilities.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="info">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Internal certificates use an 8-digit PIN for signing. External (borrower) certificates use email OTP.
                        If you enrolled as a borrower previously, you will need to enroll a new internal certificate.
                      </AlertDescription>
                    </Alert>
                  )}

                  {certificateStatus.certificateData && (
                    <div className="p-4 bg-gray-800 rounded-lg">
                      <h4 className="text-sm font-medium text-white mb-3">Certificate Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-400">Status:</span>
                          <Badge variant="success" className="ml-2">{certificateStatus.certificateData.certStatus}</Badge>
                        </div>
                        <div>
                          <span className="text-gray-400">Serial Number:</span>
                          <span className="text-white ml-2 font-mono text-xs">{certificateStatus.certificateData.certSerialNo}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Valid From:</span>
                          <span className="text-white ml-2">{certificateStatus.certificateData.validFrom}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Valid To:</span>
                          <span className="text-white ml-2">{certificateStatus.certificateData.validTo}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Enter your 8-digit Certificate PIN</Label>
                    <Input
                      type="password"
                      value={verificationPin}
                      onChange={(e) => setVerificationPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="Enter PIN to verify"
                      maxLength={8}
                      className="text-center tracking-widest max-w-xs"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleVerifyCertificateType} disabled={verifyingPin || verificationPin.length !== 8}>
                      {verifyingPin && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Verify PIN
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setCertificateStatus({
                          ...certificateStatus,
                          message: 'You chose to enroll a new internal certificate.',
                          nextStep: 'kyc',
                          isExternalCert: true
                        });
                        setVerificationPin('');
                      }}
                    >
                      I don&apos;t have a PIN / Enroll New Certificate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* KYC Step */}
            {certificateStatus?.nextStep === 'kyc' && !showPinStep && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-400" />
                    Step 1: KYC Verification
                  </CardTitle>
                  <CardDescription>
                    {certificateStatus.isExternalCert 
                      ? 'You need to enroll for an internal signing certificate. Complete KYC verification first.'
                      : 'Complete KYC verification to proceed with certificate enrollment.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {certificateStatus.isExternalCert && (
                    <Alert variant="warning">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Your existing certificate is for external (borrower) signing and uses email OTP. 
                        Internal signers (admins, attestors, witnesses) require a certificate with PIN authentication.
                      </AlertDescription>
                    </Alert>
                  )}
                  {kycSession && ctosOnboardingUrl && (
                    <Alert variant="info">
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        KYC verification in progress...{' '}
                        <a href={ctosOnboardingUrl} target="_blank" rel="noopener noreferrer" className="underline">
                          Continue verification
                        </a>
                      </AlertDescription>
                    </Alert>
                  )}

                  {kycCompleted && kycSession?.ctosResult === 1 && (
                    <Alert variant="success">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        KYC verification completed successfully!
                        <Button size="sm" className="ml-4" onClick={handleAcceptKyc}>
                          Proceed to Enrollment
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {!kycSession && (
                    <Button onClick={handleStartKyc} disabled={kycInProgress}>
                      {kycInProgress && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Start KYC Verification
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Enrollment Step */}
            {certificateStatus?.nextStep === 'enrollment' && !showPinStep && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-blue-400" />
                    Step 2: Certificate Enrollment
                  </CardTitle>
                  <CardDescription>KYC completed. You can now enroll for your digital certificate.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setShowPinStep(true)}>
                    Start Certificate Enrollment
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* PIN and Organisation Form */}
            {showPinStep && (
              <Card>
                <CardHeader>
                  <CardTitle>Certificate Enrollment</CardTitle>
                  <CardDescription>Set your 8-digit PIN and provide organisation information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* PIN Section */}
                  <div className="space-y-4">
                    <h4 className="text-white font-medium">Security PIN</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Enter 8-digit PIN</Label>
                        <Input
                          type="password"
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          placeholder="••••••••"
                          maxLength={8}
                          className="text-center tracking-widest"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Confirm PIN</Label>
                        <Input
                          type="password"
                          value={confirmPin}
                          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          placeholder="••••••••"
                          maxLength={8}
                          className="text-center tracking-widest"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Organisation Information */}
                  <div className="space-y-4">
                    <h4 className="text-white font-medium">Organisation Information</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Organisation Name *</Label>
                        <Input
                          value={organisationInfo.orgName}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgName: e.target.value})}
                          placeholder="Enter organisation name"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <Label>Your Designation *</Label>
                          <Tooltip content="Your role or title in the organisation. This can be your organisational role (e.g., Director, Manager) or your regulated professional designation (e.g., Doctor, Lawyer).">
                            <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                          </Tooltip>
                        </div>
                        <Input
                          value={organisationInfo.orgUserDesignation}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgUserDesignation: e.target.value})}
                          placeholder="e.g., Director, Manager, Doctor"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <Label>User Registration No *</Label>
                          <Tooltip content="Your registration number within the organisation. This can be your professional registration number (e.g., for regulated professions like doctors, lawyers), your employee/staff ID, or your IC number.">
                            <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                          </Tooltip>
                        </div>
                        <Input
                          value={organisationInfo.orgUserRegistrationNo}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgUserRegistrationNo: e.target.value})}
                          placeholder="e.g., Staff ID, Professional Reg No, or IC Number"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <Label>User ID Type *</Label>
                          <Tooltip content="The type of identifier used for your User Registration No. Select 'MyKad' if using your IC number or employee ID, or 'Passport' if using a passport-based identifier.">
                            <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                          </Tooltip>
                        </div>
                        <select
                          value={organisationInfo.orgUserRegistrationType}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgUserRegistrationType: e.target.value as 'PAS' | 'IDC'})}
                          className="w-full h-9 rounded-md border border-gray-600 bg-gray-700 px-3 text-sm text-white"
                        >
                          <option value="IDC">MyKad (National ID Card)</option>
                          <option value="PAS">Passport</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Organisation Address *</Label>
                      <Textarea
                        value={organisationInfo.orgAddress}
                        onChange={(e) => setOrganisationInfo({...organisationInfo, orgAddress: e.target.value})}
                        placeholder="Enter full address"
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>City *</Label>
                        <Input
                          value={organisationInfo.orgAddressCity}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgAddressCity: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State *</Label>
                        <Input
                          value={organisationInfo.orgAddressState}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgAddressState: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Postcode *</Label>
                        <Input
                          value={organisationInfo.orgAddressPostcode}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgAddressPostcode: e.target.value.replace(/\D/g, '').slice(0, 5)})}
                          maxLength={5}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Organisation Registration No *</Label>
                        <Input
                          value={organisationInfo.orgRegistationNo}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgRegistationNo: e.target.value.slice(0, 20)})}
                          placeholder="Company registration number"
                          maxLength={20}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Registration Type *</Label>
                        <select
                          value={organisationInfo.orgRegistationType}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgRegistationType: e.target.value as OrganisationInfo['orgRegistationType']})}
                          className="w-full h-9 rounded-md border border-gray-600 bg-gray-700 px-3 text-sm text-white"
                        >
                          <option value="NTRMY">Malaysia Trade Register</option>
                          <option value="IRB">Inland Revenue Board</option>
                          <option value="RMC">Royal Malaysia Customs</option>
                          <option value="CIDB">CIDB</option>
                          <option value="BAM">Board of Architects Malaysia</option>
                          <option value="GOV">Government Entity</option>
                          <option value="GOVSUB">Government Subdivision</option>
                          <option value="INT">International Organization</option>
                          <option value="LEI">LEI Registration</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phone Number *</Label>
                        <Input
                          value={organisationInfo.orgPhoneNo}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgPhoneNo: e.target.value})}
                          placeholder="+60123456789"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fax Number (Optional)</Label>
                        <Input
                          value={organisationInfo.orgFaxNo}
                          onChange={(e) => setOrganisationInfo({...organisationInfo, orgFaxNo: e.target.value})}
                          placeholder="+60312345678"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleCertificateEnrollment}
                    disabled={submittingCertificate || pin.length !== 8 || confirmPin.length !== 8}
                    className="w-full"
                  >
                    {submittingCertificate && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Enroll Certificate
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Internal Signers Tab */}
          <TabsContent value="internal-signers" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Internal Signers Registry</CardTitle>
                  <CardDescription>Manage internal users who can sign documents (admins, attestors, witnesses)</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleRefreshSigners} disabled={refreshingSigners}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshingSigners ? 'animate-spin' : ''}`} />
                    Refresh All
                  </Button>
                  <Button onClick={() => { setShowAddSignerDialog(true); setLookupResult(null); setLookupIcNumber(''); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Signer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-gray-400">Status:</Label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="h-9 rounded-md border border-gray-600 bg-gray-700 px-3 text-sm text-white"
                    >
                      <option value="">All</option>
                      <option value="PENDING">Pending</option>
                      <option value="VERIFIED">Verified</option>
                      <option value="EXPIRED">Expired</option>
                      <option value="REVOKED">Revoked</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-gray-400">Role:</Label>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="h-9 rounded-md border border-gray-600 bg-gray-700 px-3 text-sm text-white"
                    >
                      <option value="">All</option>
                      <option value="ADMIN">Admin</option>
                      <option value="ATTESTOR">Attestor</option>
                      <option value="WITNESS">Witness</option>
                      <option value="COMPANY_REP">Company Rep</option>
                    </select>
                  </div>
                </div>

                {/* Table */}
                {loadingSigners ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : internalSigners.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No internal signers found. Click &quot;Add Signer&quot; to add one.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-3 px-2 text-gray-400 font-medium">Name</th>
                          <th className="text-left py-3 px-2 text-gray-400 font-medium">IC Number</th>
                          <th className="text-left py-3 px-2 text-gray-400 font-medium">Role</th>
                          <th className="text-left py-3 px-2 text-gray-400 font-medium">Status</th>
                          <th className="text-left py-3 px-2 text-gray-400 font-medium">Cert Valid Until</th>
                          <th className="text-left py-3 px-2 text-gray-400 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {internalSigners.map((signer) => (
                          <tr key={signer.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="py-3 px-2 text-white">{signer.fullName}</td>
                            <td className="py-3 px-2 text-gray-300 font-mono text-xs">{signer.icNumber}</td>
                            <td className="py-3 px-2">
                              <Badge variant="default">{signer.signerRole}</Badge>
                            </td>
                            <td className="py-3 px-2">
                              <Badge variant={getStatusBadgeVariant(signer.status)}>{signer.status}</Badge>
                            </td>
                            <td className="py-3 px-2 text-gray-300 text-xs">
                              {signer.certValidTo ? new Date(signer.certValidTo).toLocaleDateString() : '-'}
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex gap-2">
                                {signer.status === 'PENDING' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { setSelectedSigner(signer); setShowSignerPinDialog(true); setSignerPin(''); }}
                                  >
                                    Verify PIN
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteSigner(signer.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Verify PIN Dialog */}
        <Dialog open={showVerifyPinDialog} onOpenChange={setShowVerifyPinDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify Certificate PIN</DialogTitle>
              <DialogDescription>Enter your 8-digit PIN to verify access to your certificate.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Certificate PIN</Label>
                <Input
                  type="password"
                  value={verificationPin}
                  onChange={(e) => setVerificationPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Enter 8-digit PIN"
                  maxLength={8}
                  className="text-center tracking-widest"
                />
              </div>
              {pinVerificationResult && (
                <Alert variant={pinVerificationResult.success ? 'success' : 'destructive'}>
                  {pinVerificationResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <AlertDescription>{pinVerificationResult.message}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowVerifyPinDialog(false)}>Cancel</Button>
              <Button onClick={handleVerifyPin} disabled={verifyingPin || verificationPin.length !== 8}>
                {verifyingPin && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verify PIN
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset PIN Dialog */}
        <Dialog open={showResetPinDialog} onOpenChange={setShowResetPinDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Certificate PIN</DialogTitle>
              <DialogDescription>Enter a new 8-digit PIN for your certificate.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>New PIN</Label>
                <Input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Enter new 8-digit PIN"
                  maxLength={8}
                  className="text-center tracking-widest"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm New PIN</Label>
                <Input
                  type="password"
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Confirm new PIN"
                  maxLength={8}
                  className="text-center tracking-widest"
                />
              </div>
              {pinResetResult && (
                <Alert variant={pinResetResult.success ? 'success' : 'destructive'}>
                  {pinResetResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <AlertDescription>{pinResetResult.message}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResetPinDialog(false)}>Cancel</Button>
              <Button onClick={handleResetPin} disabled={resettingPin || newPin.length !== 8 || newPin !== confirmNewPin}>
                {resettingPin && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reset PIN
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Revoke Certificate Dialog */}
        <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revoke Certificate</DialogTitle>
              <DialogDescription>This action is permanent. You will need to re-enroll to get a new certificate.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Certificate revocation cannot be undone.</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Revocation Reason</Label>
                <select
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-600 bg-gray-700 px-3 text-sm text-white"
                >
                  <option value="keyCompromise">Key Compromise</option>
                  <option value="CACompromise">CA Compromise</option>
                  <option value="affiliationChanged">Affiliation Changed</option>
                  <option value="superseded">Superseded</option>
                  <option value="cessationOfOperation">Cessation of Operation</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Requested By</Label>
                <select
                  value={revokeBy}
                  onChange={(e) => setRevokeBy(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-600 bg-gray-700 px-3 text-sm text-white"
                >
                  <option value="Self">Self</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Email OTP Verification</Label>
                {!otpRequested ? (
                  <Button variant="outline" onClick={handleRequestOtpForRevoke} disabled={requestingOtp} className="w-full">
                    {requestingOtp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Send OTP to {currentUser?.email}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Alert variant="success">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>OTP sent to {currentUser?.email}</AlertDescription>
                    </Alert>
                    <Input
                      value={revokeOtp}
                      onChange={(e) => setRevokeOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      className="text-center tracking-widest"
                    />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={handleRevokeCertificate}
                disabled={revokingCertificate || !otpRequested || revokeOtp.length !== 6}
              >
                {revokingCertificate && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Revoke Certificate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Signer Dialog */}
        <Dialog open={showAddSignerDialog} onOpenChange={setShowAddSignerDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Internal Signer</DialogTitle>
              <DialogDescription>Look up a user by IC number and add them to the registry.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Input
                  value={lookupIcNumber}
                  onChange={(e) => setLookupIcNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="Enter 12-digit IC number"
                  maxLength={12}
                  className="flex-1"
                />
                <Button onClick={handleLookupIc} disabled={lookingUp || lookupIcNumber.length !== 12}>
                  {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {lookupResult && (
                <div className="space-y-4">
                  {lookupResult.alreadyExists ? (
                    <Alert variant="warning">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>This IC number is already registered as an internal signer.</AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {lookupResult.hasCertificate ? (
                        lookupResult.isInternalCert ? (
                          <Alert variant="success">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription>
                              <strong>Internal certificate detected</strong> ({lookupResult.certificateInfo?.certStatus}).
                              After adding, they will need to verify their PIN to complete registration.
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Alert variant="warning">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              <strong>External (borrower) certificate found.</strong> This user has a certificate but it&apos;s 
                              registered for external signing (uses email OTP). They need to enroll for an internal certificate 
                              with PIN authentication to be added as an internal signer.
                            </AlertDescription>
                          </Alert>
                        )
                      ) : (
                        <Alert variant="warning">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            No valid certificate found for this IC number. This user needs to enroll for an internal 
                            signing certificate first. They can do this by logging into the admin panel and going to 
                            Settings → Signing.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Full Name *</Label>
                          <Input
                            value={newSignerName}
                            onChange={(e) => setNewSignerName(e.target.value)}
                            placeholder="Enter full name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input
                            value={newSignerEmail}
                            onChange={(e) => setNewSignerEmail(e.target.value)}
                            placeholder="Enter email address"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Role *</Label>
                          <select
                            value={newSignerRole}
                            onChange={(e) => setNewSignerRole(e.target.value)}
                            className="w-full h-9 rounded-md border border-gray-600 bg-gray-700 px-3 text-sm text-white"
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="ATTESTOR">Attestor</option>
                            <option value="WITNESS">Witness</option>
                            <option value="COMPANY_REP">Company Representative</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddSignerDialog(false)}>Cancel</Button>
              {lookupResult && !lookupResult.alreadyExists && lookupResult.isInternalCert && (
                <Button onClick={handleAddSigner} disabled={addingSigner || !newSignerName || !newSignerEmail}>
                  {addingSigner && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add as Pending
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Signer PIN Verification Dialog */}
        <Dialog open={showSignerPinDialog} onOpenChange={setShowSignerPinDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify Signer PIN</DialogTitle>
              <DialogDescription>
                Have {selectedSigner?.fullName} enter their 8-digit certificate PIN to verify.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gray-800 rounded-lg text-sm">
                <div><span className="text-gray-400">Name:</span> <span className="text-white">{selectedSigner?.fullName}</span></div>
                <div><span className="text-gray-400">IC:</span> <span className="text-white font-mono">{selectedSigner?.icNumber}</span></div>
              </div>
              <div className="space-y-2">
                <Label>Certificate PIN</Label>
                <Input
                  type="password"
                  value={signerPin}
                  onChange={(e) => setSignerPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Enter 8-digit PIN"
                  maxLength={8}
                  className="text-center tracking-widest"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSignerPinDialog(false)}>Cancel</Button>
              <Button onClick={handleVerifySignerPin} disabled={verifyingSignerPin || signerPin.length !== 8}>
                {verifyingSignerPin && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verify PIN
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
