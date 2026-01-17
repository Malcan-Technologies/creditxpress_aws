"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AdminLayout from "../../components/AdminLayout";
import { fetchWithAdminTokenRefresh } from "../../../lib/authUtils";
import Link from "next/link";
import CreditReportCard from "../../components/CreditReportCard";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Chip,
} from "@mui/material";
import {
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  ClockIcon,
  UserCircleIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  DocumentMagnifyingGlassIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  PencilSquareIcon,
  ArrowLeftIcon,
  ArrowsUpDownIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowUpTrayIcon,
  InformationCircleIcon,
  FolderIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import ConfirmationModal, { ConfirmationModalColor } from "../../../components/ConfirmationModal";

interface LoanApplication {
  id: string;
  userId: string;
  productId: string;
  amount?: number;
  term?: number;
  purpose?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  monthlyRepayment?: number;
  interestRate?: number;
  netDisbursement?: number;
  // Fee fields
  stampingFee?: number;
  legalFeeFixed?: number;
  legalFee?: number;
  originationFee?: number;
  applicationFee?: number;
  user?: {
    fullName?: string;
    phoneNumber?: string;
    email?: string;
    employmentStatus?: string;
    employerName?: string;
    monthlyIncome?: string;
    bankName?: string;
    accountNumber?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    icNumber?: string;
    idNumber?: string;
    nationality?: string;
    educationLevel?: string;
    serviceLength?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelationship?: string;
    // Demographics
    race?: string;
    gender?: string;
    occupation?: string;
  };
  product?: {
    name?: string;
    code?: string;
    description?: string;
    interestRate?: number;
    repaymentTerms?: any;
    requiredDocuments?: string[];
    collateralRequired?: boolean;
    lateFeeRate?: number;
    lateFeeFixedAmount?: number;
    lateFeeFrequencyDays?: number;
  };
  documents?: Document[];
  history?: LoanApplicationHistory[];
  loan?: {
    id: string;
    status: string;
    agreementStatus?: string;
    pkiStampCertificateUrl?: string;
    signatories?: {
      id: string;
      signatoryType: string;
      name: string;
      email: string;
      status: string;
      signedAt?: string;
    }[];
  };
  disbursement?: {
    id: string;
    referenceNumber: string;
    amount: number;
    bankName?: string;
    bankAccountNumber?: string;
    disbursedAt: string;
    disbursedBy: string;
    notes?: string;
    status: string;
    paymentSlipUrl?: string;
  };
}

interface Document {
  id: string;
  type: string;
  status: string;
  fileUrl: string;
  createdAt: string;
  updatedAt: string;
}

interface LoanApplicationHistory {
  id: string;
  applicationId: string;
  previousStatus: string | null;
  newStatus: string;
  changedBy: string;
  changeReason?: string;
  notes?: string;
  metadata?: any;
  createdAt: string;
}

interface DashboardStats {
  totalUsers: number;
  totalApplications: number;
  totalLoans: number;
  totalLoanAmount: number;
  recentApplications: {
    id: string;
    userId: string;
    status: string;
    createdAt: string;
    user: {
      fullName?: string;
      email?: string;
    };
  }[];
}

function AdminApplicationsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterParam = searchParams.get("filter");
  const tabParam = searchParams.get("tab");
  const signedParam = searchParams.get("signed");
  const applicationParam = searchParams.get("application");

  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userName, setUserName] = useState("Admin");
  const [userRole, setUserRole] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Note: PIN signing now handled in separate admin PKI page

  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] =
    useState<LoanApplication | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null
  );
  // IC Number editing states
  const [editingIcNumber, setEditingIcNumber] = useState(false);
  const [icNumberValue, setIcNumberValue] = useState("");
  const [updatingIcNumber, setUpdatingIcNumber] = useState(false);
  // Initialize tab based on URL parameters or filter type
  const getInitialTab = () => {
    if (tabParam) {
      return tabParam;
    }
    // Auto-select relevant tab based on filter
    if (filterParam === "pending-approval") {
      return "approval";
    } else if (filterParam === "pending-stamping") {
      return "stamping";
    } else if (filterParam === "pending-disbursement") {
      return "disbursement";
    } else if (filterParam === "pending_signature") {
      return "signatures";
    } else if (filterParam === "pending_company_signature") {
      return "signatures";
    } else if (filterParam === "pending_witness_signature") {
      return "signatures";
    } else if (filterParam === "pending_kyc") {
      return "details";
    }
    return "details";
  };

  // Helper function to get the appropriate tab for a given application status
  const getTabForStatus = (status: string): string => {
    if (status === "PENDING_APPROVAL") {
      return "approval";
    } else if (
      [
        "PENDING_SIGNATURE",
        "PENDING_PKI_SIGNING",
        "PENDING_SIGNING_COMPANY_WITNESS",
        "PENDING_SIGNING_OTP_DS",
      ].includes(status)
    ) {
      return "signatures";
    } else if (status === "PENDING_STAMPING") {
      return "stamping";
    } else if (status === "PENDING_DISBURSEMENT") {
      return "disbursement";
    } else if (status === "COLLATERAL_REVIEW") {
      return "collateral";
    }
    return "details";
  };

  const [selectedTab, setSelectedTab] = useState<string>(getInitialTab());
  const [refreshing, setRefreshing] = useState(false);
  const [signaturesData, setSignaturesData] = useState<any>(null);
  const [loadingSignatures, setLoadingSignatures] = useState(false);
  
  // System-wide late fee grace period setting
  const [lateFeeGraceDays, setLateFeeGraceDays] = useState<number>(3);
  
  // Document upload states
  const [uploadingDocument, setUploadingDocument] = useState<string | null>(null); // document type being uploaded
  const [documentUploadError, setDocumentUploadError] = useState<string | null>(null);
  
  // Actions tab states - hidden by default with warning
  const [showActionsTab, setShowActionsTab] = useState(false);
  const [showActionsWarningModal, setShowActionsWarningModal] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    details?: string[];
    confirmText: string;
    confirmColor: ConfirmationModalColor;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    details: [],
    confirmText: "Confirm",
    confirmColor: "blue",
    onConfirm: () => {},
  });

  // Helper to show confirmation modal
  const showConfirmModal = (config: {
    title: string;
    message: string;
    details?: string[];
    confirmText: string;
    confirmColor: ConfirmationModalColor;
    onConfirm: () => void;
  }) => {
    setConfirmModal({
      open: true,
      ...config,
    });
  };

  // Helper to close confirmation modal
  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, open: false }));
  };

  // Helper function to check if application has pending company signature
  const hasPendingCompanySignature = (app: LoanApplication): boolean => {
    if (!app.loan?.signatories) return false;
    const companySignatory = app.loan.signatories.find(
      (s) => s.signatoryType === "COMPANY"
    );
    return companySignatory
      ? ["PENDING", "PENDING_PKI_SIGNING"].includes(companySignatory.status)
      : false;
  };

  // Helper function to check if application has pending witness signature
  const hasPendingWitnessSignature = (app: LoanApplication): boolean => {
    if (!app.loan?.signatories) return false;
    const witnessSignatory = app.loan.signatories.find(
      (s) => s.signatoryType === "WITNESS"
    );
    return witnessSignatory
      ? ["PENDING", "PENDING_PKI_SIGNING"].includes(witnessSignatory.status)
      : false;
  };

  // Initialize filters based on URL parameter
  // Define all filters array as constant for reuse
  const ALL_FILTERS = [
    "PENDING_APP_FEE",
    "PENDING_PROFILE_CONFIRMATION",
    "PENDING_KYC",
    "PENDING_KYC_VERIFICATION",
    "PENDING_CERTIFICATE_OTP",
    "PENDING_APPROVAL",
    "PENDING_FRESH_OFFER",
    "PENDING_ATTESTATION",
    "CERT_CHECK",
    "PENDING_SIGNATURE",
    "PENDING_PKI_SIGNING",
    "PENDING_SIGNING_COMPANY_WITNESS",
    "PENDING_SIGNING_OTP_DS",
    "PENDING_STAMPING",
    "PENDING_DISBURSEMENT",
    "COLLATERAL_REVIEW",
  ];

  const getInitialFilters = () => {
    if (filterParam === "pending-approval") {
      return ["PENDING_APPROVAL", "COLLATERAL_REVIEW"];
    } else if (filterParam === "pending-disbursement") {
      return ["PENDING_DISBURSEMENT"];
    } else if (filterParam === "collateral-review") {
      return ["COLLATERAL_REVIEW"];
    } else if (filterParam === "pending_signature") {
      return [
        "PENDING_SIGNATURE",
        "PENDING_PKI_SIGNING",
        "PENDING_SIGNING_OTP_DS",
      ];
    } else if (filterParam === "pending_company_signature") {
      return ["PENDING_COMPANY_SIGNATURE"];
    } else if (filterParam === "pending_witness_signature") {
      return ["PENDING_WITNESS_SIGNATURE"];
    } else if (filterParam === "pending_kyc") {
      return [
        "PENDING_PROFILE_CONFIRMATION",
        "PENDING_KYC",
        "PENDING_KYC_VERIFICATION",
        "PENDING_CERTIFICATE_OTP",
      ];
    } else if (filterParam === "pending-stamping") {
      return ["PENDING_STAMPING"];
    } else if (filterParam === "pending-attestation") {
      return ["PENDING_ATTESTATION"];
    } else if (filterParam === "pending-fresh-offer") {
      return ["PENDING_FRESH_OFFER"];
    } else if (filterParam === "closed") {
      return ["REJECTED", "WITHDRAWN"];
    } else {
      // Default "All Applications" view - show active workflow statuses, exclude rejected/withdrawn/incomplete
      return ALL_FILTERS;
    }
  };

  const [selectedFilters, setSelectedFilters] = useState<string[]>(
    getInitialFilters()
  );

  // Additional states for approval and disbursement
  const [decisionNotes, setDecisionNotes] = useState("");
  const [collateralNotes, setCollateralNotes] = useState("");
  const [disbursementNotes, setDisbursementNotes] = useState("");
  const [disbursementReference, setDisbursementReference] = useState("");
  const [processingDecision, setProcessingDecision] = useState(false);
  const [processingCollateral, setProcessingCollateral] = useState(false);
  const [processingDisbursement, setProcessingDisbursement] = useState(false);

  // Fresh offer states
  const [showFreshOfferForm, setShowFreshOfferForm] = useState(false);
  const [freshOfferAmount, setFreshOfferAmount] = useState("");
  const [freshOfferTerm, setFreshOfferTerm] = useState("");
  const [freshOfferInterestRate, setFreshOfferInterestRate] = useState("");
  const [freshOfferMonthlyRepayment, setFreshOfferMonthlyRepayment] =
    useState("");
  const [freshOfferNetDisbursement, setFreshOfferNetDisbursement] =
    useState("");
  const [freshOfferStampingFee, setFreshOfferStampingFee] = useState("");
  const [freshOfferLegalFeeFixed, setFreshOfferLegalFeeFixed] = useState("");
  const [freshOfferNotes, setFreshOfferNotes] = useState("");
  const [freshOfferProductId, setFreshOfferProductId] = useState("");
  const [feeEditMode, setFeeEditMode] = useState(false);
  const [feesSavedManually, setFeesSavedManually] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [processingFreshOffer, setProcessingFreshOffer] = useState(false);
  const [statusCheckInterval, setStatusCheckInterval] =
    useState<NodeJS.Timeout | null>(null);
  
  // Credit report state
  const [creditReport, setCreditReport] = useState<any | null>(null);
  const [lastKnownStatus, setLastKnownStatus] = useState<string | null>(null);
  const [showStatusChangeAlert, setShowStatusChangeAlert] = useState(false);

  // Stamping states
  const [stampCertificateFile, setStampCertificateFile] = useState<File | null>(
    null
  );
  const [uploadingStampCertificate, setUploadingStampCertificate] =
    useState(false);
  const [stampCertificateUploaded, setStampCertificateUploaded] =
    useState(false);
  const [confirmingStamping, setConfirmingStamping] = useState(false);
  const [replacingStampCertificate, setReplacingStampCertificate] =
    useState(false);

  // Generate disbursement reference when application is selected for disbursement
  useEffect(() => {
    if (
      selectedApplication &&
      selectedApplication.status === "PENDING_DISBURSEMENT"
    ) {
      const reference = `DISB-${selectedApplication.id
        .slice(-8)
        .toUpperCase()}-${Date.now().toString().slice(-6)}`;
      setDisbursementReference(reference);
    }
  }, [selectedApplication]);

  // Status colors for badges
  const statusColors: Record<string, { bg: string; text: string }> = {
    INCOMPLETE: { bg: "bg-gray-100", text: "text-gray-800" },
    PENDING_APP_FEE: { bg: "bg-blue-100", text: "text-blue-800" },
    PENDING_KYC: { bg: "bg-indigo-100", text: "text-indigo-800" },
    PENDING_APPROVAL: { bg: "bg-yellow-100", text: "text-yellow-800" },
    PENDING_STAMPING: { bg: "bg-teal-100", text: "text-teal-800" },
    REJECTED: { bg: "bg-red-100", text: "text-red-800" },
    WITHDRAWN: { bg: "bg-gray-100", text: "text-gray-800" },
  };

  // Add missing helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "INCOMPLETE":
        return PencilSquareIcon;
      case "PENDING_APP_FEE":
        return CurrencyDollarIcon;
      case "PENDING_PROFILE_CONFIRMATION":
        return UserCircleIcon;
      case "PENDING_KYC":
        return ClipboardDocumentCheckIcon;
      case "PENDING_KYC_VERIFICATION":
        return ClipboardDocumentCheckIcon;
      case "PENDING_CERTIFICATE_OTP":
        return ClipboardDocumentCheckIcon;
      case "PENDING_APPROVAL":
        return DocumentMagnifyingGlassIcon;
      case "PENDING_FRESH_OFFER":
        return ArrowsUpDownIcon;
      case "PENDING_ATTESTATION":
        return ClipboardDocumentCheckIcon;
      case "CERT_CHECK":
        return ShieldCheckIcon;
      case "PENDING_SIGNATURE":
        return DocumentTextIcon;
      case "PENDING_PKI_SIGNING":
        return ClockIcon;
      case "PENDING_SIGNING_COMPANY_WITNESS":
        return DocumentTextIcon;
      case "PENDING_SIGNING_OTP_DS":
        return DocumentTextIcon;
      case "PENDING_STAMPING":
        return DocumentTextIcon;
      case "PENDING_DISBURSEMENT":
        return BanknotesIcon;
      case "COLLATERAL_REVIEW":
        return DocumentMagnifyingGlassIcon;
      case "ACTIVE":
        return CheckCircleIcon;
      case "REJECTED":
        return XCircleIcon;
      case "WITHDRAWN":
        return ArrowLeftIcon;
      default:
        return ClockIcon;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "INCOMPLETE":
        return "bg-yellow-500/20 text-yellow-200 border-yellow-400/20";
      case "PENDING_APP_FEE":
        return "bg-blue-500/20 text-blue-200 border-blue-400/20";
      case "PENDING_PROFILE_CONFIRMATION":
        return "bg-purple-500/20 text-purple-200 border-purple-400/20";
      case "PENDING_KYC":
        return "bg-purple-500/20 text-purple-200 border-purple-400/20";
      case "PENDING_KYC_VERIFICATION":
        return "bg-purple-500/20 text-purple-200 border-purple-400/20";
      case "PENDING_CERTIFICATE_OTP":
        return "bg-purple-500/20 text-purple-200 border-purple-400/20";
      case "PENDING_APPROVAL":
        return "bg-amber-500/20 text-amber-200 border-amber-400/20";
      case "PENDING_FRESH_OFFER":
        return "bg-pink-500/20 text-pink-200 border-pink-400/20";
      case "PENDING_ATTESTATION":
        return "bg-cyan-500/20 text-cyan-200 border-cyan-400/20";
      case "CERT_CHECK":
        return "bg-sky-500/20 text-sky-200 border-sky-400/20";
      case "PENDING_SIGNATURE":
        return "bg-indigo-500/20 text-indigo-200 border-indigo-400/20";
      case "PENDING_PKI_SIGNING":
        return "bg-purple-500/20 text-purple-200 border-purple-400/20";
      case "PENDING_SIGNING_COMPANY_WITNESS":
        return "bg-teal-500/20 text-teal-200 border-teal-400/20";
      case "PENDING_SIGNING_OTP_DS":
        return "bg-indigo-500/20 text-indigo-200 border-indigo-400/20";
      case "PENDING_STAMPING":
        return "bg-teal-500/20 text-teal-200 border-teal-400/20";
      case "PENDING_DISBURSEMENT":
        return "bg-emerald-500/20 text-emerald-200 border-emerald-400/20";
      case "COLLATERAL_REVIEW":
        return "bg-orange-500/20 text-orange-200 border-orange-400/20";
      case "ACTIVE":
        return "bg-green-500/20 text-green-200 border-green-400/20";
      case "REJECTED":
        return "bg-red-500/20 text-red-200 border-red-400/20";
      case "WITHDRAWN":
        return "bg-gray-500/20 text-gray-200 border-gray-400/20";
      default:
        return "bg-gray-500/20 text-gray-200 border-gray-400/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "INCOMPLETE":
        return "Incomplete";
      case "PENDING_APP_FEE":
        return "Pending Application Fee";
      case "PENDING_PROFILE_CONFIRMATION":
        return "Pending Profile Confirmation";
      case "PENDING_KYC":
        return "Pending KYC";
      case "PENDING_KYC_VERIFICATION":
        return "Pending KYC Verification";
      case "PENDING_CERTIFICATE_OTP":
        return "Pending Certificate OTP";
      case "PENDING_APPROVAL":
        return "Pending Approval";
      case "PENDING_FRESH_OFFER":
        return "Counter Offer Pending";
      case "PENDING_ATTESTATION":
        return "Pending Attestation";
      case "CERT_CHECK":
        return "Certificate Check";
      case "PENDING_SIGNATURE":
        return "Pending Signature";
      case "PENDING_PKI_SIGNING":
        return "Pending PKI Signing";
      case "PENDING_SIGNING_COMPANY_WITNESS":
        return "Awaiting Signatures";
      case "PENDING_SIGNING_OTP_DS":
        return "Pending Signing OTP";
      case "PENDING_STAMPING":
        return "Pending Stamp Certificate";
      case "PENDING_DISBURSEMENT":
        return "Pending Disbursement";
      case "COLLATERAL_REVIEW":
        return "Collateral Review";
      case "ACTIVE":
        return "Active";
      case "REJECTED":
        return "Rejected";
      case "WITHDRAWN":
        return "Withdrawn";
      default:
        return status.replace(/_/g, " ").toLowerCase();
    }
  };

  // Add function to update refresh button
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setError(null);

      // Fetch user data and role
      let currentUserRole = "";
      try {
        const userData = await fetchWithAdminTokenRefresh<any>("/api/admin/me");
        if (userData.fullName) {
          setUserName(userData.fullName);
        }
        if (userData.role) {
          currentUserRole = userData.role;
          setUserRole(userData.role);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }

      // ATTESTOR users get filtered applications from backend
      if (currentUserRole === "ATTESTOR") {
        try {
          const response = await fetchWithAdminTokenRefresh<{
            success: boolean;
            data: LoanApplication[];
            systemSettings?: { lateFeeGraceDays: number };
          }>("/api/admin/applications");

          if (response.success && response.data) {
            setApplications(response.data);
            if (response.systemSettings?.lateFeeGraceDays !== undefined) {
              setLateFeeGraceDays(response.systemSettings.lateFeeGraceDays);
            }
          } else {
            setApplications([]);
          }
        } catch (error) {
          console.error("Error refreshing applications for ATTESTOR:", error);
          setApplications([]);
        }
        return;
      }

      // Try fetching applications from applications endpoint (ADMIN only)
      try {
        const response = await fetchWithAdminTokenRefresh<
          | {
              success: boolean;
              data: LoanApplication[];
              systemSettings?: { lateFeeGraceDays: number };
            }
          | LoanApplication[]
          | { error?: string; message?: string }
        >("/api/admin/applications");
        
        // Check for error responses
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          if ('error' in response || 'message' in response) {
            const errorMsg = (response as { error?: string; message?: string }).error || 
                            (response as { error?: string; message?: string }).message;
            console.error('API returned error:', errorMsg);
            setError(errorMsg || 'Failed to refresh applications');
            return;
          }
        }
        
        // Extract applications - handle both wrapped format { success, data } and direct array format
        let applicationsData: LoanApplication[] = [];
        if (Array.isArray(response)) {
          // Direct array format
          applicationsData = response;
        } else if (response && typeof response === 'object') {
          // Wrapped format { success, data, systemSettings }
          if ('data' in response && Array.isArray((response as { data?: unknown }).data)) {
            applicationsData = (response as { data: LoanApplication[] }).data;
          }
          if ('systemSettings' in response) {
            const settings = (response as { systemSettings?: { lateFeeGraceDays?: number } }).systemSettings;
            if (settings?.lateFeeGraceDays !== undefined) {
              setLateFeeGraceDays(settings.lateFeeGraceDays);
            }
          }
        }

        // Ensure applicationsData is always an array
        if (!Array.isArray(applicationsData)) {
          console.error('Applications data is not an array:', applicationsData);
          applicationsData = [];
        }

        // If no applications, set empty array and return early
        if (applicationsData.length === 0) {
          setApplications([]);
          return;
        }

        // For each application, fetch its history
        const applicationsWithHistory = await Promise.all(
          applicationsData.map(async (app) => {
            try {
              const historyData = await fetchWithAdminTokenRefresh<
                | {
                    applicationId: string;
                    currentStatus: string;
                    timeline: LoanApplicationHistory[];
                  }
                | LoanApplicationHistory[]
              >(`/api/admin/applications/${app.id}/history`);

              // Handle both old array format and new object format
              let history: LoanApplicationHistory[] = [];
              if (Array.isArray(historyData)) {
                // Old format - direct array
                history = historyData;
              } else if (
                historyData &&
                typeof historyData === "object" &&
                "timeline" in historyData
              ) {
                // New format - object with timeline property
                history = historyData.timeline || [];
              }

              return { ...app, history };
            } catch (historyError) {
              console.error(
                `Error fetching history for application ${app.id}:`,
                historyError
              );
              return app;
            }
          })
        );

        setApplications(applicationsWithHistory);

        // If there's a selected application, update it with fresh data
        if (selectedApplication) {
          const updatedApp = applicationsWithHistory.find(
            (app) => app.id === selectedApplication.id
          );
          if (updatedApp) {
            setSelectedApplication(updatedApp);

            // If we're currently on the signatures tab and the application has signature-related status, refresh signatures data
            if (
              selectedTab === "signatures" &&
              [
                "PENDING_SIGNATURE",
                "PENDING_PKI_SIGNING",
                "PENDING_SIGNING_COMPANY_WITNESS",
                "PENDING_SIGNING_OTP_DS",
              ].includes(updatedApp.status)
            ) {
              await fetchSignatureStatus(updatedApp.id);
            }
          }
        }
        toast.success("Applications refreshed successfully");
      } catch (appError) {
        console.error("Error fetching applications:", appError);
        setError("Failed to refresh applications. Please try again.");
        toast.error("Failed to refresh applications");
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
      setError("An unexpected error occurred during refresh.");
      toast.error("An unexpected error occurred during refresh");
    } finally {
      setRefreshing(false);
    }
  };

  // Define fetchApplications outside of useEffect so it can be reused
  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user data and role
      let currentUserRole = "";
      try {
        const userData = await fetchWithAdminTokenRefresh<any>("/api/admin/me");
        if (userData.fullName) {
          setUserName(userData.fullName);
        }
        if (userData.role) {
          currentUserRole = userData.role;
          setUserRole(userData.role);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }

      // ATTESTOR users get filtered applications from backend
      if (currentUserRole === "ATTESTOR") {
        try {
          const response = await fetchWithAdminTokenRefresh<{
            success: boolean;
            data: LoanApplication[];
            systemSettings?: { lateFeeGraceDays: number };
          }>("/api/admin/applications");

          if (response.success && response.data) {
            setApplications(response.data);
            if (response.systemSettings?.lateFeeGraceDays !== undefined) {
              setLateFeeGraceDays(response.systemSettings.lateFeeGraceDays);
            }
          } else {
            setApplications([]);
          }
        } catch (error) {
          console.error("Error fetching applications for ATTESTOR:", error);
          setApplications([]);
        }
        setLoading(false);
        return;
      }

      // Try fetching applications from applications endpoint (ADMIN only)
      try {
        const response = await fetchWithAdminTokenRefresh<
          | {
              success: boolean;
              data: LoanApplication[];
              systemSettings?: { lateFeeGraceDays: number };
            }
          | LoanApplication[]
          | { error?: string; message?: string }
        >("/api/admin/applications");
        
        // Check for error responses
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          if ('error' in response || 'message' in response) {
            const errorMsg = (response as { error?: string; message?: string }).error || 
                            (response as { error?: string; message?: string }).message;
            console.error('API returned error:', errorMsg);
            setError(errorMsg || 'Failed to load applications');
            setApplications([]);
            setLoading(false);
            return;
          }
        }
        
        // Extract applications - handle both wrapped format { success, data } and direct array format
        let applicationsData: LoanApplication[] = [];
        if (Array.isArray(response)) {
          // Direct array format
          applicationsData = response;
        } else if (response && typeof response === 'object') {
          // Wrapped format { success, data, systemSettings }
          if ('data' in response && Array.isArray((response as { data?: unknown }).data)) {
            applicationsData = (response as { data: LoanApplication[] }).data;
          }
          if ('systemSettings' in response) {
            const settings = (response as { systemSettings?: { lateFeeGraceDays?: number } }).systemSettings;
            if (settings?.lateFeeGraceDays !== undefined) {
              setLateFeeGraceDays(settings.lateFeeGraceDays);
            }
          }
        }

        // Ensure applicationsData is always an array
        if (!Array.isArray(applicationsData)) {
          console.error('Applications data is not an array:', applicationsData);
          applicationsData = [];
        }

        // If no applications, set empty array and return early
        if (applicationsData.length === 0) {
          setApplications([]);
          setLoading(false);
          return;
        }

        // For each application, fetch its history
        const applicationsWithHistory = await Promise.all(
          applicationsData.map(async (app) => {
            try {
              const historyData = await fetchWithAdminTokenRefresh<
                | {
                    applicationId: string;
                    currentStatus: string;
                    timeline: LoanApplicationHistory[];
                  }
                | LoanApplicationHistory[]
              >(`/api/admin/applications/${app.id}/history`);

              // Handle both old array format and new object format
              let history: LoanApplicationHistory[] = [];
              if (Array.isArray(historyData)) {
                // Old format - direct array
                history = historyData;
              } else if (
                historyData &&
                typeof historyData === "object" &&
                "timeline" in historyData
              ) {
                // New format - object with timeline property
                history = historyData.timeline || [];
              }

              return { ...app, history };
            } catch (historyError) {
              console.error(
                `Error fetching history for application ${app.id}:`,
                historyError
              );
              return app;
            }
          })
        );

        setApplications(applicationsWithHistory);
      } catch (appError) {
        console.error("Error fetching applications:", appError);
        try {
          const dashboardData =
            await fetchWithAdminTokenRefresh<DashboardStats>(
              "/api/admin/dashboard"
            );

          // Convert dashboard recent applications to full application format
          const recentApps = dashboardData.recentApplications.map((app) => ({
            ...app,
            productId: "",
            updatedAt: app.createdAt,
          }));

          setApplications(recentApps);
        } catch (dashboardError) {
          console.error("Error fetching dashboard data:", dashboardError);
          setError(
            "Failed to load applications. Please check API implementation."
          );
        }
      }

      // Check for application ID in URL query params
      const params = new URLSearchParams(window.location.search);
      const applicationId = params.get("id");

      if (applicationId && applications.length > 0) {
        const selectedApp = applications.find(
          (app) => app.id === applicationId
        );
        if (selectedApp) {
          setSelectedApplication(selectedApp);
          setViewDialogOpen(true);
          // Fetch full application details (includes product requiredDocuments, late fees, etc.)
          try {
            const detailResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/admin/applications/${applicationId}`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
                },
              }
            );
            if (detailResponse.ok) {
              const fullApplication = await detailResponse.json();
              setSelectedApplication(fullApplication);
            }
          } catch (detailError) {
            console.error("Error fetching application details:", detailError);
          }
        }
      }
    } catch (error) {
      console.error("Error in applications page:", error);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
      setRefreshing(false); // Make sure to stop refreshing state
    }
  };

  // Update user IC number
  const updateUserIcNumber = async (userId: string, newIcNumber: string) => {
    try {
      setUpdatingIcNumber(true);
      await fetchWithAdminTokenRefresh<any>(
        `/api/admin/users/${userId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            icNumber: newIcNumber.trim(),
          }),
        }
      );

      // Refresh the application data
      await fetchApplications();
      
      // Update selected application state
      if (selectedApplication) {
        setSelectedApplication({
          ...selectedApplication,
          user: {
            ...selectedApplication.user,
            icNumber: newIcNumber.trim(),
          },
        });
      }

      setEditingIcNumber(false);
      toast.success("IC number updated successfully");
    } catch (error) {
      console.error("Error updating IC number:", error);
      toast.error(
        `Failed to update IC number: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setUpdatingIcNumber(false);
    }
  };

  const fetchSignatureStatus = async (applicationId: string) => {
    if (!applicationId) return;

    setLoadingSignatures(true);
    try {
      const data = await fetchWithAdminTokenRefresh<{
        success: boolean;
        data: any;
      }>(`/api/admin/applications/${applicationId}/signatures`);

      if (data.success) {
        setSignaturesData(data.data);
      } else {
        console.error("Failed to fetch signature status");
        setSignaturesData(null);
      }
    } catch (error) {
      console.error("Error fetching signature status:", error);
      setSignaturesData(null);
    } finally {
      setLoadingSignatures(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // Update filters when URL parameter changes
  useEffect(() => {
    setSelectedFilters(getInitialFilters());
  }, [filterParam]);

  // Update tab when URL parameter changes
  useEffect(() => {
    setSelectedTab(getInitialTab());
  }, [tabParam, filterParam]);

 	// Fetch signature status when signatures tab is selected OR for stamping tab
	useEffect(() => {
	if (
	  (selectedTab === "signatures" || selectedTab === "stamping") &&
	  selectedApplication &&
	  [
		"PENDING_SIGNATURE",
		"PENDING_PKI_SIGNING",
		"PENDING_SIGNING_COMPANY_WITNESS",
		"PENDING_SIGNING_OTP_DS",
		"PENDING_STAMPING", // Add this status
	  ].includes(selectedApplication.status)
	) {
	  fetchSignatureStatus(selectedApplication.id);
	}
  }, [selectedTab, selectedApplication?.id, selectedApplication?.status]);

  // Redirect ATTESTOR users from restricted tabs
  useEffect(() => {
    if (
      userRole === "ATTESTOR" &&
      ["documents", "audit", "actions"].includes(selectedTab)
    ) {
      setSelectedTab("details"); // Default to details tab for ATTESTOR users
    }
  }, [userRole, selectedTab]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return "N/A";
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
    }).format(amount);
  };

  // Handle PIN-based signing for internal users
  // Note: PIN signing now handled in separate admin PKI page

  // Filter applications based on search and status filters
  const filteredApplications = applications.filter((app) => {
    // Filter by search term
    const searchTerm = search.toLowerCase();
    const matchesSearch =
      (app.id?.toLowerCase() || "").includes(searchTerm) ||
      (app.user?.fullName?.toLowerCase() || "").includes(searchTerm) ||
      (app.user?.email?.toLowerCase() || "").includes(searchTerm) ||
      (app.purpose?.toLowerCase() || "").includes(searchTerm) ||
      (app.product?.name?.toLowerCase() || "").includes(searchTerm) ||
      (app.status?.toLowerCase() || "").includes(searchTerm);

    // Filter by statuses - if no filters selected, show all
    let matchesStatus = selectedFilters.length === 0;

    // Check if app matches any of the selected filters
    if (selectedFilters.length > 0) {
      matchesStatus = selectedFilters.some((filter) => {
        // Handle special signature filters
        if (filter === "PENDING_COMPANY_SIGNATURE") {
          return (
            app.status === "PENDING_SIGNING_COMPANY_WITNESS" &&
            hasPendingCompanySignature(app)
          );
        } else if (filter === "PENDING_WITNESS_SIGNATURE") {
          return (
            app.status === "PENDING_SIGNING_COMPANY_WITNESS" &&
            hasPendingWitnessSignature(app)
          );
        } else {
          // Handle regular status filters
          return app.status === filter;
        }
      });
    }

    return matchesSearch && matchesStatus;
  });

  // Auto-select the first application when filtered results change
  useEffect(() => {
    // If application ID is provided in URL, try to select that application first
    if (applicationParam && filteredApplications.length > 0) {
      const appFromUrl = filteredApplications.find((app) => app.id === applicationParam);
      if (appFromUrl) {
        // Only update if the selected application is different from the URL parameter
        if (!selectedApplication || selectedApplication.id !== applicationParam) {
          setSelectedApplication(appFromUrl);
        }
        return;
      }
    }
    
    // Auto-select the first application if there are results and no application is currently selected or selected application is not in filtered results
    if (
      filteredApplications.length > 0 &&
      (!selectedApplication ||
        !filteredApplications.find((app) => app.id === selectedApplication.id))
    ) {
      const firstApp = filteredApplications[0];
      setSelectedApplication(firstApp);

      // Auto-switch to appropriate tab based on status (unless tab is explicitly set via URL)
      if (!tabParam) {
        setSelectedTab(getTabForStatus(firstApp.status));
      }
    }
    // Clear selection if no results
    else if (filteredApplications.length === 0) {
      setSelectedApplication(null);
    }
  }, [filteredApplications, selectedApplication, applicationParam, tabParam]);

  // Sync stamp certificate state when selected application changes
  useEffect(() => {
    if (selectedApplication?.loan?.pkiStampCertificateUrl) {
      // Certificate already exists in the backend, mark as uploaded
      setStampCertificateUploaded(true);
      // Clear the file input state since we don't need it anymore
      setStampCertificateFile(null);
      // Reset replacing state
      setReplacingStampCertificate(false);
    } else {
      // Reset state when switching to an application without a certificate
      setStampCertificateUploaded(false);
      setStampCertificateFile(null);
      setReplacingStampCertificate(false);
    }
  }, [
    selectedApplication?.id,
    selectedApplication?.loan?.pkiStampCertificateUrl,
  ]);

  // Note: Credit reports are NOT auto-fetched to avoid unnecessary CTOS API charges
  // Reports are only fetched when admin explicitly clicks "Fetch Credit Report" button
  // The POST endpoint checks for cached reports (7-day TTL) before calling CTOS API

  // Clear credit report when switching applications
  useEffect(() => {
    setCreditReport(null);
  }, [selectedApplication?.id]);

  // Handle filter toggle
  const toggleFilter = (status: string) => {
    if (selectedFilters.includes(status)) {
      setSelectedFilters(selectedFilters.filter((s) => s !== status));
    } else {
      setSelectedFilters([...selectedFilters, status]);
    }
  };

  // Check if current filters match "All Applications" state
  const isAllFiltersSelected = () => {
    if (selectedFilters.length !== ALL_FILTERS.length) {
      return false;
    }
    return ALL_FILTERS.every((filter) => selectedFilters.includes(filter));
  };

  // Fetch full application details (includes all product fields like requiredDocuments, late fees, etc.)
  const fetchApplicationDetails = async (applicationId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/applications/${applicationId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          },
        }
      );
      if (response.ok) {
        const fullApplication = await response.json();
        setSelectedApplication(fullApplication);
      }
    } catch (error) {
      console.error("Error fetching application details:", error);
    }
  };

  // Handle view application details
  const handleViewClick = (application: LoanApplication) => {
    // Set initial data from list, then fetch full details
    setSelectedApplication(application);
    
    // Fetch full application details (includes product requiredDocuments, late fees, etc.)
    fetchApplicationDetails(application.id);

    // Determine the appropriate tab based on status (unless tab is explicitly set via URL)
    let newTab = tabParam;
    if (!tabParam) {
      newTab = getTabForStatus(application.status);
      setSelectedTab(newTab);
    }

    // Update URL to reflect the selected application, preserving filter and tab
    const params = new URLSearchParams();
    if (filterParam) {
      params.set("filter", filterParam);
    }
    if (newTab) {
      params.set("tab", newTab);
    }
    params.set("application", application.id);
    
    // Use router.push to update URL without causing a full page reload
    router.push(`/dashboard/applications?${params.toString()}`, { scroll: false });
  };

  const handleViewClose = () => {
    setViewDialogOpen(false);
    setSelectedApplication(null);
    setDecisionNotes("");
    setDisbursementNotes("");
    setDisbursementReference("");
  };

  // Function to fetch updated history for an application
  const fetchApplicationHistory = async (applicationId: string) => {
    try {
      const historyData = await fetchWithAdminTokenRefresh<
        | {
            applicationId: string;
            currentStatus: string;
            timeline: LoanApplicationHistory[];
          }
        | LoanApplicationHistory[]
      >(`/api/admin/applications/${applicationId}/history`);

      // Handle both old array format and new object format
      let history: LoanApplicationHistory[] = [];
      if (Array.isArray(historyData)) {
        // Old format - direct array
        history = historyData;
      } else if (
        historyData &&
        typeof historyData === "object" &&
        "timeline" in historyData
      ) {
        // New format - object with timeline property
        history = historyData.timeline || [];
      }

      return history;
    } catch (error) {
      console.error(
        `Error fetching history for application ${applicationId}:`,
        error
      );
      return [];
    }
  };

  // Handle status change with optimistic locking and conflict detection
  const handleStatusChange = async (
    applicationId: string,
    newStatus: string,
    notes?: string
  ) => {
    try {
      const currentApp =
        applications.find((app) => app.id === applicationId) ||
        selectedApplication;
      const currentStatus = currentApp?.status;

      const updatedApplication =
        await fetchWithAdminTokenRefresh<LoanApplication>(
          `/api/admin/applications/${applicationId}/status`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status: newStatus,
              notes,
              currentStatus, // Send current status for optimistic locking
            }),
          }
        );

      // Fetch the updated history after status change
      const updatedHistory = await fetchApplicationHistory(applicationId);
      const applicationWithHistory = {
        ...updatedApplication,
        history: updatedHistory,
      };

      setApplications(
        applications.map((app) =>
          app.id === applicationId ? applicationWithHistory : app
        )
      );

      if (selectedApplication?.id === applicationId) {
        setSelectedApplication(applicationWithHistory);
      }
    } catch (error: any) {
      console.error("Error updating application status:", error);

      // Handle specific error cases
      if (error.error === "LOAN_ALREADY_DISBURSED") {
        toast.error(
          `Cannot modify this application. This loan has already been disbursed. Disbursed: ${
              error.disbursedAt
                ? new Date(error.disbursedAt).toLocaleString()
                : "Unknown"
            }\n` +
            `By: ${error.disbursedBy || "Unknown admin"}\n\n` +
            `The page will automatically refresh to show the current status.`
        );
        // Automatically refresh the applications list to keep all admins in sync
        await fetchApplications();
        // Show status change alert to indicate the page was refreshed
        setShowStatusChangeAlert(true);
      } else if (error.error === "STATUS_CONFLICT") {
        // Show notification and automatically refresh
        toast.warning(
          `Status Conflict: Another admin changed this application. Expected: ${error.expectedStatus}, Current: ${error.actualStatus}. Page will refresh.`
        );

        // Automatically refresh to keep all admins in sync
        await fetchApplications();
        // If this was the selected application, refresh its details
        if (selectedApplication?.id === applicationId) {
          const refreshedApp = applications.find(
            (app) => app.id === applicationId
          );
          if (refreshedApp) {
            setSelectedApplication(refreshedApp);
          }
        }
        // Show status change alert to indicate the page was refreshed
        setShowStatusChangeAlert(true);
      } else {
        toast.error(
          `Failed to update status: ${error.message || "Unknown error"}. Please try again.`
        );
      }
    }
  };

  const getDocumentTypeName = (type: string): string => {
    const documentTypeMap: Record<string, string> = {
      ID: "Identification Document",
      PAYSLIP: "Pay Slip",
      BANK_STATEMENT: "Bank Statement",
      UTILITY_BILL: "Utility Bill",
      EMPLOYMENT_LETTER: "Employment Letter",
      OTHER: "Other Document",
    };

    return documentTypeMap[type] || type;
  };

  // Helper function to check if a loan is already disbursed
  const isLoanDisbursed = (application: LoanApplication): boolean => {
    return (
      application.status === "ACTIVE" ||
      (application as any).loan?.status === "ACTIVE" ||
      !!(application as any).disbursement
    );
  };

  // Function to check for status changes in real-time
  const checkForStatusChanges = async (applicationId: string) => {
    try {
      const currentApp = await fetchWithAdminTokenRefresh<LoanApplication>(
        `/api/admin/applications/${applicationId}`,
        { method: "GET" }
      );

      if (lastKnownStatus && currentApp.status !== lastKnownStatus) {
        setShowStatusChangeAlert(true);
        // Update the application in the list
        setApplications((prev) =>
          prev.map((app) =>
            app.id === applicationId
              ? { ...app, status: currentApp.status }
              : app
          )
        );
        // Update selected application if it's the one being checked
        if (selectedApplication?.id === applicationId) {
          setSelectedApplication((prev) =>
            prev ? { ...prev, status: currentApp.status } : null
          );
        }
      }
      setLastKnownStatus(currentApp.status);
    } catch (error) {
      console.error("Error checking status changes:", error);
    }
  };

  // Start periodic status checking when an application is selected
  useEffect(() => {
    if (selectedApplication?.id && !isLoanDisbursed(selectedApplication)) {
      setLastKnownStatus(selectedApplication.status);

      // Clear any existing interval
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        setStatusCheckInterval(null);
      }

      // Set up new interval to check every 30 seconds
      const interval = setInterval(() => {
        checkForStatusChanges(selectedApplication.id);
      }, 30000);

      setStatusCheckInterval(interval);

      return () => {
        clearInterval(interval);
        setStatusCheckInterval(null);
      };
    } else {
      // Clear interval if no application selected or loan is disbursed
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        setStatusCheckInterval(null);
      }
    }
  }, [selectedApplication?.id, selectedApplication?.status]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [statusCheckInterval]);

  const getDocumentStatusColor = (
    status: string
  ): { bg: string; text: string } => {
    const statusMap: Record<string, { bg: string; text: string }> = {
      PENDING: { bg: "bg-yellow-100", text: "text-yellow-800" },
      APPROVED: { bg: "bg-green-100", text: "text-green-800" },
      REJECTED: { bg: "bg-red-100", text: "text-red-800" },
    };

    return statusMap[status] || { bg: "bg-gray-100", text: "text-gray-800" };
  };

  // Format document URL by prepending backend URL if it's a relative path
  const formatDocumentUrl = (fileUrl: string, documentId: string): string => {
    if (!fileUrl) return "";

    // If the URL already includes http(s), it's already an absolute URL
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      return fileUrl;
    }

    // For relative URLs, use the loan-applications API endpoint instead of direct file access
    if (selectedApplication && documentId) {
      return `${process.env.NEXT_PUBLIC_API_URL}/api/loan-applications/${selectedApplication.id}/documents/${documentId}`;
    }

    // Fallback to old method if no application is selected (this shouldn't happen in normal usage)
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    const cleanFileUrl = fileUrl.startsWith("/")
      ? fileUrl.substring(1)
      : fileUrl;
    return `${backendUrl}/${cleanFileUrl}`;
  };

  // Handle document status change
  const handleDocumentStatusChange = async (
    documentId: string,
    newStatus: string
  ) => {
    try {
      if (!selectedApplication) return;

      // Call the API to update document status
      const updatedDocument = await fetchWithAdminTokenRefresh<any>(
        `/api/admin/documents/${documentId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        }
      );

      // Update the application in state with the new document status
      if (selectedApplication && selectedApplication.documents) {
        const updatedDocuments = selectedApplication.documents.map((doc) =>
          doc.id === documentId ? { ...doc, status: newStatus } : doc
        );

        setSelectedApplication({
          ...selectedApplication,
          documents: updatedDocuments,
        });

        // Also update in the applications list
        setApplications(
          applications.map((app) =>
            app.id === selectedApplication.id
              ? { ...app, documents: updatedDocuments }
              : app
          )
        );
      }
    } catch (error) {
      console.error("Error updating document status:", error);
      toast.error(
        "Failed to update document status. API endpoint may not be implemented yet."
      );
    }
  };

  // Handle document upload by admin
  const handleAdminDocumentUpload = async (
    documentType: string,
    file: File
  ) => {
    if (!selectedApplication) return;

    try {
      setUploadingDocument(documentType);
      setDocumentUploadError(null);

      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        setDocumentUploadError('Only PDF, JPG, and PNG files are allowed');
        setUploadingDocument(null);
        return;
      }

      // Validate file size (50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        setDocumentUploadError('File size must be less than 50MB');
        setUploadingDocument(null);
        return;
      }

      // Create FormData
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', documentType);

      // Upload document
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/applications/${selectedApplication.id}/documents`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload document');
      }

      const result = await response.json();

      // Update the application in state with the new document
      if (selectedApplication) {
        const newDocument = {
          id: result.document.id,
          type: result.document.type,
          status: result.document.status,
          fileUrl: result.document.fileUrl,
          createdAt: result.document.createdAt,
          updatedAt: result.document.createdAt,
        };

        const updatedDocuments = [...(selectedApplication.documents || []), newDocument];

        setSelectedApplication({
          ...selectedApplication,
          documents: updatedDocuments,
        });

        // Also update in the applications list
        setApplications(
          applications.map((app) =>
            app.id === selectedApplication.id
              ? { ...app, documents: updatedDocuments }
              : app
          )
        );
      }

      setUploadingDocument(null);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      setDocumentUploadError(error.message || 'Failed to upload document');
      setUploadingDocument(null);
    }
  };

  // Handle document deletion by admin
  const handleAdminDocumentDelete = async (documentId: string) => {
    if (!selectedApplication) return;

    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/applications/${selectedApplication.id}/documents/${documentId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete document');
      }

      // Update the application in state
      if (selectedApplication && selectedApplication.documents) {
        const updatedDocuments = selectedApplication.documents.filter(
          (doc) => doc.id !== documentId
        );

        setSelectedApplication({
          ...selectedApplication,
          documents: updatedDocuments,
        });

        // Also update in the applications list
        setApplications(
          applications.map((app) =>
            app.id === selectedApplication.id
              ? { ...app, documents: updatedDocuments }
              : app
          )
        );
      }
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast.error(error.message || 'Failed to delete document');
    }
  };

  // Add this function to get a user-friendly action description
  const getHistoryActionDescription = (
    previousStatus: string | null,
    newStatus: string,
    changeReason?: string
  ): string => {
    // Handle credit report fetch
    if (changeReason === "CREDIT_REPORT_FETCHED") {
      return "Admin fetched credit report from CTOS";
    }

    // Handle document upload by admin
    if (changeReason === "ADMIN_DOCUMENT_UPLOAD" || newStatus === "DOCUMENT_UPLOADED") {
      return "Admin uploaded document";
    }

    // Handle document deletion by admin
    if (changeReason === "ADMIN_DOCUMENT_DELETE" || newStatus === "DOCUMENT_DELETED") {
      return "Admin deleted document";
    }

    // Handle document approval by admin
    if (changeReason === "ADMIN_DOCUMENT_APPROVED" || newStatus === "DOCUMENT_APPROVED") {
      return "Admin approved document";
    }

    // Handle document rejection by admin
    if (changeReason === "ADMIN_DOCUMENT_REJECTED" || newStatus === "DOCUMENT_REJECTED") {
      return "Admin rejected document";
    }

    // Handle document status change by admin
    if (newStatus === "DOCUMENT_STATUS_CHANGED") {
      return "Admin changed document status";
    }

    if (!previousStatus) {
      return `Application created with status: ${getStatusLabel(newStatus)}`;
    }

    return `Status changed to ${getStatusLabel(newStatus)}`;
  };

  // Process approval decision (called after confirmation)
  const processApprovalDecision = async (decision: "approve" | "reject") => {
    if (!selectedApplication) return;

    setProcessingDecision(true);
    try {
      const newStatus = decision === "approve" ? "APPROVED" : "REJECTED";
      const notes = decisionNotes || `Application ${decision}d by admin`;

      await handleStatusChange(selectedApplication.id, newStatus, notes);

      // Clear decision notes and refresh data
      setDecisionNotes("");
      await fetchApplications();
      await fetchApplicationHistory(selectedApplication.id);
      
      // Update the selected application status and switch to appropriate tab
      setSelectedApplication((prev) =>
        prev ? { ...prev, status: newStatus } : null
      );
      setSelectedTab(getTabForStatus(newStatus));
      
      // Show success toast
      toast.success(decision === "approve" 
        ? `Application approved for ${selectedApplication.user?.fullName}` 
        : `Application rejected for ${selectedApplication.user?.fullName}`);
    } catch (error) {
      console.error(`Error ${decision}ing application:`, error);
      // Error handling is already done in handleStatusChange
    } finally {
      setProcessingDecision(false);
    }
  };

  // Approval decision handler - shows confirmation modal
  const handleApprovalDecision = (decision: "approve" | "reject") => {
    if (!selectedApplication) return;

    const isApprove = decision === "approve";
    showConfirmModal({
      title: isApprove ? "Approve Application" : "Reject Application",
      message: `Are you sure you want to ${decision} this loan application?`,
      details: [
        `Applicant: ${selectedApplication.user?.fullName || "Unknown"}`,
        `Amount: ${selectedApplication.amount ? `RM ${selectedApplication.amount.toLocaleString()}` : "Not set"}`,
        `Product: ${selectedApplication.product?.name || "Unknown"}`,
      ],
      confirmText: isApprove ? "Approve Application" : "Reject Application",
      confirmColor: isApprove ? "green" : "red",
      onConfirm: () => {
        closeConfirmModal();
        processApprovalDecision(decision);
      },
    });
  };

  // Process collateral decision (called after confirmation)
  const processCollateralDecision = async (decision: "approve" | "reject") => {
    if (!selectedApplication) return;

    setProcessingCollateral(true);
    try {
      const newStatus =
        decision === "approve" ? "PENDING_DISBURSEMENT" : "REJECTED";
      const notes = collateralNotes || `Collateral ${decision}d by admin`;

      await handleStatusChange(selectedApplication.id, newStatus, notes);

      // Clear collateral notes and refresh data
      setCollateralNotes("");
      await fetchApplications();
      await fetchApplicationHistory(selectedApplication.id);
      
      // Update the selected application status and switch to appropriate tab
      setSelectedApplication((prev) =>
        prev ? { ...prev, status: newStatus } : null
      );
      setSelectedTab(getTabForStatus(newStatus));
      
      // Show success toast
      toast.success(decision === "approve" 
        ? `Collateral approved for ${selectedApplication.user?.fullName}` 
        : `Collateral rejected for ${selectedApplication.user?.fullName}`);
    } catch (error) {
      console.error(`Error ${decision}ing collateral application:`, error);
      // Error handling is already done in handleStatusChange
    } finally {
      setProcessingCollateral(false);
    }
  };

  // Collateral decision handler - shows confirmation modal
  const handleCollateralDecision = (decision: "approve" | "reject") => {
    if (!selectedApplication) return;

    const isApprove = decision === "approve";
    showConfirmModal({
      title: isApprove ? "Approve Collateral" : "Reject Collateral",
      message: `Are you sure you want to ${decision} this collateral loan application?`,
      details: [
        `Applicant: ${selectedApplication.user?.fullName || "Unknown"}`,
        `Amount: ${selectedApplication.amount ? `RM ${selectedApplication.amount.toLocaleString()}` : "Not set"}`,
        `Product: ${selectedApplication.product?.name || "Unknown"}`,
      ],
      confirmText: isApprove ? "Approve Collateral" : "Reject Collateral",
      confirmColor: isApprove ? "green" : "red",
      onConfirm: () => {
        closeConfirmModal();
        processCollateralDecision(decision);
      },
    });
  };

  // Process disbursement (called after confirmation)
  const processDisbursement = async () => {
    if (!selectedApplication || !disbursementReference) return;

    setProcessingDisbursement(true);
    try {
      const response = await fetch(
        `/api/admin/applications/${selectedApplication.id}/disburse`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          },
          body: JSON.stringify({
            referenceNumber: disbursementReference,
            notes: disbursementNotes || "Loan disbursed by admin",
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Refresh the application data
        await fetchApplications();
        await fetchApplicationHistory(selectedApplication.id);
        setDisbursementNotes("");
        setDisbursementReference("");

        // Update selected application and switch to details tab (ACTIVE loans don't have action tabs)
        setSelectedApplication((prev) =>
          prev ? { ...prev, status: "ACTIVE" } : null
        );
        setSelectedTab("details");
        
        // Show success toast
        toast.success(`Loan disbursed successfully for ${selectedApplication.user?.fullName}`);
      } else {
        const errorData = await response.json();
        console.error("Disbursement error:", errorData);
        setError(
          errorData.error || errorData.message || "Failed to disburse loan"
        );
      }
    } catch (error) {
      console.error("Error disbursing loan:", error);
      setError("Failed to disburse loan");
    } finally {
      setProcessingDisbursement(false);
    }
  };

  // Disbursement handler - shows confirmation modal
  const handleDisbursement = () => {
    if (!selectedApplication || !disbursementReference) return;

    const disbursementAmount =
      selectedApplication.netDisbursement || selectedApplication.amount;

    showConfirmModal({
      title: "Confirm Disbursement",
      message: `Please confirm that you have already completed the bank transfer for the correct amount before proceeding.`,
      details: [
        `Applicant: ${selectedApplication.user?.fullName || "Unknown"}`,
        `Amount: ${formatCurrency(disbursementAmount)}`,
        `Reference: ${disbursementReference}`,
        `Bank: ${selectedApplication.user?.bankName || "Not set"}`,
        `Account: ${selectedApplication.user?.accountNumber || "Not set"}`,
        ``,
        `⚠️ IMPORTANT:`,
        `• Ensure the bank transfer has been completed`,
        `• Upload the disbursement slip later in Loans → Disbursements tab`,
      ],
      confirmText: "I Confirm - Disburse Loan",
      confirmColor: "green",
      onConfirm: () => {
        closeConfirmModal();
        processDisbursement();
      },
    });
  };

  // Process fresh offer (called after confirmation)
  const processFreshOffer = async () => {
    if (!selectedApplication) return;

    setProcessingFreshOffer(true);
    try {
      const response = await fetchWithAdminTokenRefresh(
        `/api/admin/applications/${selectedApplication.id}/fresh-offer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: parseFloat(freshOfferAmount),
            term: parseInt(freshOfferTerm),
            interestRate: parseFloat(freshOfferInterestRate),
            monthlyRepayment: parseFloat(freshOfferMonthlyRepayment),
            netDisbursement: parseFloat(freshOfferNetDisbursement),
            stampingFee: parseFloat(freshOfferStampingFee),
            legalFeeFixed: parseFloat(freshOfferLegalFeeFixed),
            productId: freshOfferProductId,
            notes: freshOfferNotes,
          }),
        }
      );

      // Clear form and refresh data
      setShowFreshOfferForm(false);
      setFreshOfferAmount("");
      setFreshOfferTerm("");
      setFreshOfferInterestRate("");
      setFreshOfferMonthlyRepayment("");
      setFreshOfferNetDisbursement("");
      setFreshOfferStampingFee("");
      setFreshOfferLegalFeeFixed("");
      setFreshOfferProductId("");
      setFreshOfferNotes("");
      setFeeEditMode(false); // Reset edit mode after successful submission
      setFeesSavedManually(false); // Reset manual flag after successful submission

      await fetchApplications();
      await fetchApplicationHistory(selectedApplication.id);

      // Update selected application status and switch to details tab
      setSelectedApplication((prev) =>
        prev ? { ...prev, status: "PENDING_FRESH_OFFER" } : null
      );
      setSelectedTab("details");
      
      // Show success toast
      toast.success(`Counter offer sent to ${selectedApplication.user?.fullName}`);
    } catch (error) {
      console.error("Error submitting counter offer:", error);
      setError("Failed to submit counter offer");
    } finally {
      setProcessingFreshOffer(false);
    }
  };

  // Fresh offer handler - shows confirmation modal
  const handleFreshOfferSubmission = () => {
    if (!selectedApplication) return;

    // Validate required fields
    if (
      !freshOfferAmount ||
      !freshOfferTerm ||
      !freshOfferInterestRate ||
      !freshOfferMonthlyRepayment ||
      !freshOfferNetDisbursement ||
      !freshOfferStampingFee ||
      !freshOfferLegalFeeFixed ||
      !freshOfferProductId
    ) {
      setError(
        "All counter offer fields are required, including product selection and fee amounts"
      );
      return;
    }

    // Calculate fee breakdown for display
    const legalFeeValue = parseFloat(freshOfferLegalFeeFixed) || 0;
    const stampingFeeValue = parseFloat(freshOfferStampingFee) || 0;
    const totalFees = legalFeeValue + stampingFeeValue;
    const loanAmount = parseFloat(freshOfferAmount) || 0;

    // Get product info to show stamping fee percentage
    const selectedProduct = products.find((p) => p.id === freshOfferProductId);
    const productStampingFeePercentage = selectedProduct?.stampingFee || 0;
    const calculatedStampingFee = (loanAmount * productStampingFeePercentage) / 100;
    
    // Calculate actual percentage being charged (reverse-calculate from amount)
    const actualStampingFeePercentage = loanAmount > 0 ? (stampingFeeValue / loanAmount) * 100 : 0;
    const isManuallyAdjusted = Math.abs(stampingFeeValue - calculatedStampingFee) > 0.01;

    showConfirmModal({
      title: "Send Counter Offer",
      message: `Are you sure you want to send a counter offer to ${selectedApplication.user?.fullName}?`,
      details: [
        `Loan Amount: RM ${loanAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        `Term: ${freshOfferTerm} months`,
        `Interest Rate: ${freshOfferInterestRate}% monthly`,
        `Monthly Repayment: RM ${parseFloat(freshOfferMonthlyRepayment).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        `Legal Fee: RM ${legalFeeValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        `Stamping Fee${isManuallyAdjusted ? ` (${actualStampingFeePercentage.toFixed(2)}%)` : ` (${productStampingFeePercentage}%)`}: RM ${stampingFeeValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        `Total Fees: RM ${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        `Net Disbursement: RM ${parseFloat(freshOfferNetDisbursement).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      ],
      confirmText: "Send Counter Offer",
      confirmColor: "purple",
      onConfirm: () => {
        closeConfirmModal();
        processFreshOffer();
      },
    });
  };

  // Fetch products for selection
  const fetchProducts = async () => {
    try {
      const productsData = await fetchWithAdminTokenRefresh<any[]>(
        "/api/admin/products"
      );
      setProducts(productsData || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  // Calculate monthly repayment based on amount, term, and interest rate
  const calculateMonthlyRepayment = (
    principal: number,
    termInMonths: number,
    interestRate: number
  ) => {
    // Convert interest rate from percentage to decimal
    const monthlyInterestRate = interestRate / 100;

    // Calculate total interest for the loan period (flat rate)
    const totalInterest = principal * monthlyInterestRate * termInMonths;

    // Monthly interest payment
    const monthlyInterest = totalInterest / termInMonths;

    // Monthly principal payment
    const monthlyPrincipal = principal / termInMonths;

    // Total monthly payment is principal + interest
    const monthlyPayment = monthlyPrincipal + monthlyInterest;

    return monthlyPayment;
  };

  // Auto-calculate monthly repayment when amount, term, or interest rate changes
  const updateCalculatedFields = () => {
    const amount = parseFloat(freshOfferAmount);
    const term = parseInt(freshOfferTerm);
    const interestRate = parseFloat(freshOfferInterestRate);

    if (amount && term && interestRate) {
      const monthlyRepayment = calculateMonthlyRepayment(
        amount,
        term,
        interestRate
      );
      setFreshOfferMonthlyRepayment(monthlyRepayment.toFixed(2));

      // Calculate fees based on selected product
      const selectedProduct = products.find(
        (p) => p.id === freshOfferProductId
      );
      
      if (selectedProduct) {
        // Calculate new fee structure: legal fee (fixed) and stamping fee (%)
        const legalFeeValue = selectedProduct.legalFeeFixed || 0;
        const stampingFeeValue = (amount * (selectedProduct.stampingFee || 0)) / 100;

        if (!feeEditMode && !feesSavedManually) {
          // Auto-mode: Set both legal fee (fixed) and stamping fee (calculated)
          setFreshOfferLegalFeeFixed(legalFeeValue.toFixed(2));
          setFreshOfferStampingFee(stampingFeeValue.toFixed(2));

          // Calculate net disbursement
          const netDisbursement = amount - legalFeeValue - stampingFeeValue;
          setFreshOfferNetDisbursement(netDisbursement.toFixed(2));
        } else {
          // Manual mode: Only recalculate stamping fee (based on percentage), keep legal fee as-is
          setFreshOfferStampingFee(stampingFeeValue.toFixed(2));
          
          // Recalculate net disbursement with current legal fee and new stamping fee
          const currentLegalFee = parseFloat(freshOfferLegalFeeFixed) || 0;
          const netDisbursement = amount - currentLegalFee - stampingFeeValue;
          setFreshOfferNetDisbursement(netDisbursement.toFixed(2));
        }
      }
    } else if (!amount) {
      // Clear all calculated fields if amount is empty
      setFreshOfferMonthlyRepayment("");
      setFreshOfferNetDisbursement("");
      setFreshOfferLegalFeeFixed("");
      setFreshOfferStampingFee("");
      setFeeEditMode(false); // Reset edit mode when clearing
      setFeesSavedManually(false); // Reset manual flag when clearing
    }
  };

  // Handle fee edit mode
  const handleEditFees = () => {
    setFeeEditMode(true);
  };

  // Handle manual fee changes during edit mode
  const handleFeeChange = (
    feeType: "legalFixed" | "stamping",
    value: string
  ) => {
    // Update the specific fee state
    if (feeType === "legalFixed") {
      setFreshOfferLegalFeeFixed(value);
    } else if (feeType === "stamping") {
      setFreshOfferStampingFee(value);
    }

    // Immediately update net disbursement if we have amount and are in edit mode
    const amount = parseFloat(freshOfferAmount);
    if (amount && feeEditMode) {
      // Get current values, using the new value for the changed fee
      // Handle empty strings and invalid numbers properly
      const getValue = (currentValue: string) => {
        const parsed = parseFloat(currentValue);
        return isNaN(parsed) ? 0 : parsed;
      };

      const legalFeeFixed =
        feeType === "legalFixed" ? getValue(value) : getValue(freshOfferLegalFeeFixed);
      const stampingFee =
        feeType === "stamping"
          ? getValue(value)
          : getValue(freshOfferStampingFee);

      const netDisbursement = amount - legalFeeFixed - stampingFee;
      setFreshOfferNetDisbursement(netDisbursement.toFixed(2));
    }
  };

  const handleSaveFees = () => {
    // First calculate net disbursement with the manually entered fees
    const amount = parseFloat(freshOfferAmount);
    if (amount) {
      // Handle empty strings and invalid numbers properly
      const getValue = (currentValue: string) => {
        const parsed = parseFloat(currentValue);
        return isNaN(parsed) ? 0 : parsed;
      };

      const legalFeeValue = getValue(freshOfferLegalFeeFixed);
      const stampingFeeValue = getValue(freshOfferStampingFee);

      const netDisbursement = amount - legalFeeValue - stampingFeeValue;
      setFreshOfferNetDisbursement(netDisbursement.toFixed(2));
    }

    // Mark fees as manually saved and exit edit mode
    setFeesSavedManually(true);
    setFeeEditMode(false);
  };

  // Populate fresh offer form with current application data
  const populateFreshOfferForm = async () => {
    if (selectedApplication) {
      // Fetch products if not already loaded
      if (products.length === 0) {
        await fetchProducts();
      }

      setFreshOfferAmount(selectedApplication.amount?.toString() || "");
      setFreshOfferTerm(selectedApplication.term?.toString() || "");
      setFreshOfferInterestRate(
        selectedApplication.interestRate?.toString() || ""
      );
      setFreshOfferMonthlyRepayment(
        selectedApplication.monthlyRepayment?.toString() || ""
      );
      setFreshOfferNetDisbursement(
        selectedApplication.netDisbursement?.toString() || ""
      );
      
      // Populate fees from existing application data
      const existingStampingFee = (selectedApplication as any).stampingFee;
      const existingLegalFeeFixed = (selectedApplication as any).legalFeeFixed;
      
      setFreshOfferStampingFee(
        existingStampingFee?.toString() || ""
      );
      setFreshOfferLegalFeeFixed(
        existingLegalFeeFixed?.toString() || ""
      );
      
      setFreshOfferProductId(selectedApplication.productId || "");
      setFreshOfferNotes("");
      setFeeEditMode(false); // Reset edit mode when populating form
      
      // Mark fees as manually saved only if they exist AND have meaningful values (not 0)
      // This prevents auto-calculation from overwriting actual existing fees
      // but allows recalculation if fees were 0 or null
      if (existingStampingFee > 0 || existingLegalFeeFixed > 0) {
        setFeesSavedManually(true);
      } else {
        setFeesSavedManually(false);
      }
      
      setShowFreshOfferForm(true);
    }
  };

  // Auto-calculate when fresh offer values change
  useEffect(() => {
    if (showFreshOfferForm) {
      updateCalculatedFields();
    }
  }, [
    freshOfferAmount,
    freshOfferTerm,
    freshOfferInterestRate,
    freshOfferProductId,
    products,
    showFreshOfferForm,
  ]);

  if (loading) {
    return (
      <AdminLayout userName={userName}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </AdminLayout>
    );
  }

  const getPageTitle = () => {
    if (filterParam === "pending-approval") {
      return "Pending Approval";
    } else if (filterParam === "pending-disbursement") {
      return "Pending Disbursement";
    } else if (filterParam === "collateral-review") {
      return "Collateral Review";
    } else if (filterParam === "pending_signature") {
      return "Pending User Signature";
    } else if (filterParam === "pending_company_signature") {
      return "Pending Company Signature";
    } else if (filterParam === "pending_witness_signature") {
      return "Pending Witness Signature";
    } else if (filterParam === "pending_kyc") {
      return "Pending KYC";
    } else {
      return "Loan Applications";
    }
  };

  const getPageDescription = () => {
    if (filterParam === "pending-approval") {
      return "Review and make credit decisions on loan applications";
    } else if (filterParam === "pending-disbursement") {
      return "Process loan disbursements for approved applications";
    } else if (filterParam === "collateral-review") {
      return "Review collateral-based loan applications requiring asset evaluation";
    } else if (filterParam === "pending_signature") {
      return "Manage user document signing process for approved loan applications";
    } else if (filterParam === "pending_company_signature") {
      return "Manage company signing process for loan agreements";
    } else if (filterParam === "pending_witness_signature") {
      return "Manage witness signing process for loan agreements";
    } else if (filterParam === "pending_kyc") {
      return "Review KYC verification and profile confirmation processes";
    } else {
      return "Manage active loan applications in the workflow (excludes incomplete, rejected, and withdrawn)";
    }
  };

  return (
    <AdminLayout title={getPageTitle()} description={getPageDescription()}>
      {/* DocuSeal completion now redirects to separate admin PKI page */}

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-700/30 border border-red-600/30 text-red-300 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <XCircleIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Status Change Alert */}
      {showStatusChangeAlert && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-400/20 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-amber-400 mr-3 flex-shrink-0" />
              <div>
                <p className="text-amber-200 font-medium">
                  Application Status Changed
                </p>
                <p className="text-amber-300/70 text-sm">
                  This application's status has been updated by another admin.
                  The page has been automatically refreshed.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowStatusChangeAlert(false)}
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header and Controls */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Application Management
          </h2>
          <p className="text-gray-400">
            {filteredApplications.length} application
            {filteredApplications.length !== 1 ? "s" : ""} •{" "}
            {
              applications.filter((app) => app.status === "PENDING_APPROVAL")
                .length
            }{" "}
            pending approval •{" "}
            {
              applications.filter((app) =>
                [
                  "PENDING_SIGNATURE",
                  "PENDING_PKI_SIGNING",
                  "PENDING_SIGNING_COMPANY_WITNESS",
                  "PENDING_SIGNING_OTP_DS",
                ].includes(app.status)
              ).length
            }{" "}
            pending signature •{" "}
            {
              applications.filter((app) =>
                [
                  "PENDING_PROFILE_CONFIRMATION",
                  "PENDING_KYC",
                  "PENDING_KYC_VERIFICATION",
                  "PENDING_CERTIFICATE_OTP",
                ].includes(app.status)
              ).length
            }{" "}
            pending KYC •{" "}
            {
              applications.filter((app) => app.status === "PENDING_STAMPING")
                .length
            }{" "}
            pending stamping •{" "}
            {
              applications.filter(
                (app) => app.status === "PENDING_DISBURSEMENT"
              ).length
            }{" "}
            pending disbursement
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="mt-4 md:mt-0 flex items-center px-4 py-2 bg-blue-500/20 text-blue-200 rounded-lg border border-blue-400/20 hover:bg-blue-500/30 transition-colors"
        >
          {refreshing ? (
            <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ArrowPathIcon className="h-4 w-4 mr-2" />
          )}
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-4 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-10 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            placeholder="Search by applicant name, email, purpose, or application ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300 transition-colors"
              title="Clear search"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setSelectedFilters(ALL_FILTERS);
              router.push("/dashboard/applications");
            }}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              isAllFiltersSelected()
                ? "bg-blue-500/30 text-blue-100 border-blue-400/30"
                : "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
            }`}
          >
            All (
            {
              applications.filter((app) =>
                ALL_FILTERS.includes(app.status || "")
              ).length
            }
            )
          </button>
          <button
            onClick={() => {
              setSelectedFilters(["PENDING_APPROVAL", "COLLATERAL_REVIEW"]);
              router.push("/dashboard/applications?filter=pending-approval");
            }}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              selectedFilters.length === 2 &&
              selectedFilters.includes("PENDING_APPROVAL") &&
              selectedFilters.includes("COLLATERAL_REVIEW")
                ? "bg-amber-500/30 text-amber-100 border-amber-400/30"
                : "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
            }`}
          >
            Pending Approval (
            {
              applications.filter(
                (app) =>
                  app.status === "PENDING_APPROVAL" ||
                  app.status === "COLLATERAL_REVIEW"
              ).length
            }
            )
          </button>
          <button
            onClick={() => {
              setSelectedFilters([
                "PENDING_PROFILE_CONFIRMATION",
                "PENDING_KYC",
                "PENDING_KYC_VERIFICATION",
                "PENDING_CERTIFICATE_OTP",
              ]);
              router.push("/dashboard/applications?filter=pending_kyc");
            }}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              selectedFilters.length === 4 &&
              selectedFilters.includes("PENDING_PROFILE_CONFIRMATION") &&
              selectedFilters.includes("PENDING_KYC") &&
              selectedFilters.includes("PENDING_KYC_VERIFICATION") &&
              selectedFilters.includes("PENDING_CERTIFICATE_OTP")
                ? "bg-purple-500/30 text-purple-100 border-purple-400/30"
                : "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
            }`}
          >
            Pending KYC (
            {
              applications.filter((app) =>
                [
                  "PENDING_PROFILE_CONFIRMATION",
                  "PENDING_KYC",
                  "PENDING_KYC_VERIFICATION",
                  "PENDING_CERTIFICATE_OTP",
                ].includes(app.status || "")
              ).length
            }
            )
          </button>
          <button
            onClick={() => {
              setSelectedFilters([
                "PENDING_SIGNATURE",
                "PENDING_PKI_SIGNING",
                "PENDING_SIGNING_OTP_DS",
              ]);
              router.push("/dashboard/applications?filter=pending_signature");
            }}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              selectedFilters.length === 3 &&
              selectedFilters.includes("PENDING_SIGNATURE") &&
              selectedFilters.includes("PENDING_PKI_SIGNING") &&
              selectedFilters.includes("PENDING_SIGNING_OTP_DS")
                ? "bg-indigo-500/30 text-indigo-100 border-indigo-400/30"
                : "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
            }`}
          >
            Pending User Signature (
            {
              applications.filter((app) =>
                [
                  "PENDING_SIGNATURE",
                  "PENDING_PKI_SIGNING",
                  "PENDING_SIGNING_OTP_DS",
                ].includes(app.status || "")
              ).length
            }
            )
          </button>
          <button
            onClick={() => {
              setSelectedFilters(["PENDING_COMPANY_SIGNATURE"]);
              router.push(
                "/dashboard/applications?filter=pending_company_signature"
              );
            }}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              selectedFilters.length === 1 &&
              selectedFilters.includes("PENDING_COMPANY_SIGNATURE")
                ? "bg-teal-500/30 text-teal-100 border-teal-400/30"
                : "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
            }`}
          >
            Pending Company Signature (
            {
              applications.filter(
                (app) =>
                  app.status === "PENDING_SIGNING_COMPANY_WITNESS" &&
                  hasPendingCompanySignature(app)
              ).length
            }
            )
          </button>
          <button
            onClick={() => {
              setSelectedFilters(["PENDING_WITNESS_SIGNATURE"]);
              router.push(
                "/dashboard/applications?filter=pending_witness_signature"
              );
            }}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              selectedFilters.length === 1 &&
              selectedFilters.includes("PENDING_WITNESS_SIGNATURE")
                ? "bg-orange-500/30 text-orange-100 border-orange-400/30"
                : "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
            }`}
          >
            Pending Witness Signature (
            {
              applications.filter(
                (app) =>
                  app.status === "PENDING_SIGNING_COMPANY_WITNESS" &&
                  hasPendingWitnessSignature(app)
              ).length
            }
            )
          </button>
          <button
            onClick={() => {
              setSelectedFilters(["PENDING_STAMPING"]);
              router.push("/dashboard/applications?filter=pending-stamping");
            }}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              selectedFilters.length === 1 &&
              selectedFilters.includes("PENDING_STAMPING")
                ? "bg-teal-500/30 text-teal-100 border-teal-400/30"
                : "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
            }`}
          >
            Pending Stamping (
            {
              applications.filter((app) => app.status === "PENDING_STAMPING")
                .length
            }
            )
          </button>
          <button
            onClick={() => {
              setSelectedFilters(["PENDING_DISBURSEMENT"]);
              router.push(
                "/dashboard/applications?filter=pending-disbursement"
              );
            }}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              selectedFilters.length === 1 &&
              selectedFilters.includes("PENDING_DISBURSEMENT")
                ? "bg-green-500/30 text-green-100 border-green-400/30"
                : "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
            }`}
          >
            Pending Disbursement (
            {
              applications.filter(
                (app) => app.status === "PENDING_DISBURSEMENT"
              ).length
            }
            )
          </button>
          <button
            onClick={() => {
              setSelectedFilters(["COLLATERAL_REVIEW"]);
              router.push("/dashboard/applications?filter=collateral-review");
            }}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              selectedFilters.length === 1 &&
              selectedFilters.includes("COLLATERAL_REVIEW")
                ? "bg-orange-500/30 text-orange-100 border-orange-400/30"
                : "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
            }`}
          >
            Collateral Review (
            {
              applications.filter((app) => app.status === "COLLATERAL_REVIEW")
                .length
            }
            )
          </button>
          <button
            onClick={() => {
              setSelectedFilters(["PENDING_FRESH_OFFER"]);
              router.push("/dashboard/applications?filter=pending-fresh-offer");
            }}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              selectedFilters.length === 1 &&
              selectedFilters.includes("PENDING_FRESH_OFFER")
                ? "bg-pink-500/30 text-pink-100 border-pink-400/30"
                : "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
            }`}
          >
            Counter Offers (
            {
              applications.filter((app) => app.status === "PENDING_FRESH_OFFER")
                .length
            }
            )
          </button>
          <button
            onClick={() => {
              setSelectedFilters(["REJECTED", "WITHDRAWN"]);
              router.push("/dashboard/applications?filter=closed");
            }}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              selectedFilters.length === 2 &&
              selectedFilters.includes("REJECTED") &&
              selectedFilters.includes("WITHDRAWN")
                ? "bg-red-500/30 text-red-100 border-red-400/30"
                : "bg-gray-700/50 text-gray-300 border-gray-600/30 hover:bg-gray-700/70"
            }`}
          >
            Closed (
            {
              applications.filter((app) =>
                ["REJECTED", "WITHDRAWN"].includes(app.status || "")
              ).length
            }
            )
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Application List */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-700/30">
              <h3 className="text-lg font-medium text-white">
                Applications ({filteredApplications.length})
              </h3>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
              {loading ? (
                <div className="flex justify-center items-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400"></div>
                </div>
              ) : filteredApplications.length > 0 ? (
                <ul className="divide-y divide-gray-700/30">
                  {filteredApplications.map((app) => {
                    const StatusIcon = getStatusIcon(app.status);
                    return (
                      <li
                        key={app.id}
                        className={`p-4 hover:bg-gray-800/30 transition-colors cursor-pointer ${
                          selectedApplication?.id === app.id
                            ? "bg-gray-800/50"
                            : ""
                        }`}
                        onClick={() => handleViewClick(app)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-white font-medium">
                              {app.user?.fullName || "Unknown"}
                            </p>
                            <p className="text-sm text-gray-400">
                              {app.user?.email || "N/A"}
                            </p>
                            <div className="mt-2 flex items-center text-sm text-gray-300">
                              <CurrencyDollarIcon className="mr-1 h-4 w-4 text-blue-400" />
                              {app.amount
                                ? formatCurrency(app.amount)
                                : "Amount not set"}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getStatusColor(
                                app.status
                              )}`}
                            >
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {getStatusLabel(app.status)}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              Applied: {formatDate(app.createdAt)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Product: {app.product?.name || "N/A"}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="p-8 text-center">
                  <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-4 text-gray-300">
                    {search
                      ? "No applications found"
                      : "No applications found with the selected filters"}
                  </p>
                  {search && (
                    <p className="text-sm text-gray-400 mt-2">
                      Try adjusting your search criteria
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Application Details */}
        <div className="lg:col-span-2">
          {selectedApplication ? (
            <div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 border-b border-gray-700/30 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium text-white">
                    Application Details
                  </h3>
                  <div className="mt-1.5 flex items-center gap-2">
                    {(() => {
                      const StatusIcon = getStatusIcon(selectedApplication.status);
                      return (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedApplication.status)}`}>
                          <StatusIcon className="h-3.5 w-3.5 mr-1" />
                          {getStatusLabel(selectedApplication.status)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <span className="px-2 py-1 bg-gray-500/20 text-gray-300 text-xs font-medium rounded-full border border-gray-400/20">
                  ID: {selectedApplication.id.substring(0, 8)}
                </span>
              </div>

              <div className="p-6">
                {/* Tab Navigation */}
                <div className="flex flex-wrap border-b border-gray-700/30 mb-6">
                  <div
                    className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
                      selectedTab === "details"
                        ? "border-b-2 border-blue-400 font-medium text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                    onClick={() => setSelectedTab("details")}
                  >
                    <InformationCircleIcon className="h-4 w-4 mr-1.5" />
                    Details
                  </div>
                  {/* Documents tab - ADMIN only, highlighted for collateral review */}
                  {userRole === "ADMIN" && (
                    <div
                      className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
                        selectedTab === "documents"
                          ? selectedApplication.status === "COLLATERAL_REVIEW"
                            ? "border-b-2 border-amber-400 font-medium text-white bg-amber-500/10"
                            : "border-b-2 border-blue-400 font-medium text-white"
                          : selectedApplication.status === "COLLATERAL_REVIEW"
                            ? "text-amber-300 hover:text-amber-200 bg-amber-500/5 hover:bg-amber-500/10"
                            : "text-gray-400 hover:text-gray-200"
                      }`}
                      onClick={() => setSelectedTab("documents")}
                    >
                      <FolderIcon className="h-4 w-4 mr-1.5" />
                      <span>Documents</span>
                      {selectedApplication?.documents &&
                        selectedApplication.documents.length > 0 && (
                          <span className={`ml-1.5 text-xs font-medium px-1.5 py-0.5 rounded-full border ${
                            selectedApplication.status === "COLLATERAL_REVIEW"
                              ? "bg-amber-500/20 text-amber-200 border-amber-400/20"
                              : "bg-blue-500/20 text-blue-200 border-blue-400/20"
                          }`}>
                            {selectedApplication.documents.length}
                          </span>
                        )}
                      {selectedApplication.status === "COLLATERAL_REVIEW" && (
                        <span className="ml-1.5 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                      )}
                    </div>
                  )}
                  {/* Audit Trail tab - ADMIN only */}
                  {userRole === "ADMIN" && (
                    <div
                      className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
                        selectedTab === "audit"
                          ? "border-b-2 border-blue-400 font-medium text-white"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                      onClick={() => setSelectedTab("audit")}
                    >
                      <DocumentTextIcon className="h-4 w-4 mr-1.5" />
                      Audit Trail
                    </div>
                  )}
                  {/* Show Signatures tab for signature-related applications - ACTION REQUIRED */}
                  {[
                    "PENDING_SIGNATURE",
                    "PENDING_PKI_SIGNING",
                    "PENDING_SIGNING_COMPANY_WITNESS",
                    "PENDING_SIGNING_OTP_DS",
                  ].includes(selectedApplication.status) && (
                    <div
                      className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
                        selectedTab === "signatures"
                          ? "border-b-2 border-purple-400 font-medium text-white bg-purple-500/10"
                          : "text-purple-300 hover:text-purple-200 bg-purple-500/5 hover:bg-purple-500/10"
                      }`}
                      onClick={() => setSelectedTab("signatures")}
                    >
                      <PencilSquareIcon className="h-4 w-4 mr-1.5" />
                      Signatures
                      <span className="ml-1.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                      </span>
                    </div>
                  )}
                  {/* Show Credit Report tab for PENDING_APPROVAL applications - ADMIN only */}
                  {selectedApplication.status === "PENDING_APPROVAL" && userRole === "ADMIN" && (
                    <div
                      className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
                        selectedTab === "credit-report"
                          ? "border-b-2 border-blue-400 font-medium text-white"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                      onClick={() => setSelectedTab("credit-report")}
                    >
                      <ShieldCheckIcon className="h-4 w-4 mr-1.5" />
                      Credit Report
                    </div>
                  )}
                  {/* Show Approval tab for PENDING_APPROVAL applications - ACTION REQUIRED */}
                  {selectedApplication.status === "PENDING_APPROVAL" && (
                    <div
                      className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
                        selectedTab === "approval"
                          ? "border-b-2 border-amber-400 font-medium text-white bg-amber-500/10"
                          : "text-amber-300 hover:text-amber-200 bg-amber-500/5 hover:bg-amber-500/10"
                      }`}
                      onClick={() => setSelectedTab("approval")}
                    >
                      <DocumentMagnifyingGlassIcon className="h-4 w-4 mr-1.5" />
                      Approval
                      <span className="ml-1.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                    </div>
                  )}
                  {/* Show Collateral Review tab for COLLATERAL_REVIEW applications - ACTION REQUIRED */}
                  {selectedApplication.status === "COLLATERAL_REVIEW" && (
                    <div
                      className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
                        selectedTab === "collateral"
                          ? "border-b-2 border-amber-400 font-medium text-white bg-amber-500/10"
                          : "text-amber-300 hover:text-amber-200 bg-amber-500/5 hover:bg-amber-500/10"
                      }`}
                      onClick={() => setSelectedTab("collateral")}
                    >
                      <ClipboardDocumentCheckIcon className="h-4 w-4 mr-1.5" />
                      Collateral Review
                      <span className="ml-1.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                    </div>
                  )}
                  {/* Show Stamping tab for PENDING_STAMPING applications - ACTION REQUIRED */}
                  {selectedApplication.status === "PENDING_STAMPING" && (
                    <div
                      className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
                        selectedTab === "stamping"
                          ? "border-b-2 border-teal-400 font-medium text-white bg-teal-500/10"
                          : "text-teal-300 hover:text-teal-200 bg-teal-500/5 hover:bg-teal-500/10"
                      }`}
                      onClick={() => setSelectedTab("stamping")}
                    >
                      <DocumentTextIcon className="h-4 w-4 mr-1.5" />
                      Stamping
                      <span className="ml-1.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-teal-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                      </span>
                    </div>
                  )}
                  {/* Show Disbursement tab for PENDING_DISBURSEMENT applications - ACTION REQUIRED */}
                  {selectedApplication.status === "PENDING_DISBURSEMENT" && (
                    <div
                      className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
                        selectedTab === "disbursement"
                          ? "border-b-2 border-green-400 font-medium text-white bg-green-500/10"
                          : "text-green-300 hover:text-green-200 bg-green-500/5 hover:bg-green-500/10"
                      }`}
                      onClick={() => setSelectedTab("disbursement")}
                    >
                      <BanknotesIcon className="h-4 w-4 mr-1.5" />
                      Disbursement
                      <span className="ml-1.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                    </div>
                  )}
                  {/* Actions tab - ADMIN only, hidden by default */}
                  {userRole === "ADMIN" && showActionsTab && (
                    <div
                      className={`px-4 py-2 cursor-pointer transition-colors flex items-center ${
                        selectedTab === "actions"
                          ? "border-b-2 border-red-400 font-medium text-white bg-red-500/10"
                          : "text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10"
                      }`}
                      onClick={() => setSelectedTab("actions")}
                    >
                      <ExclamationTriangleIcon className="h-4 w-4 mr-1.5" />
                      <span className="text-xs">Dev Actions</span>
                    </div>
                  )}
                  {/* Toggle to show Actions tab - ADMIN only */}
                  {userRole === "ADMIN" && !showActionsTab && (
                    <div
                      className="px-2 py-2 cursor-pointer transition-colors flex items-center text-gray-500 hover:text-gray-400"
                      onClick={() => setShowActionsWarningModal(true)}
                      title="Show developer actions (testing only)"
                    >
                      <Cog6ToothIcon className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>

                {/* Tab Content */}
                {selectedTab === "details" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Applicant Information - Enhanced */}
                    <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
                      <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                        <UserCircleIcon className="h-5 w-5 mr-2 text-blue-400" />
                        Applicant Information
                      </h4>
                      
                      {/* Basic Info */}
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Full Name</span>
                          <span className="text-white font-medium">
                            {selectedApplication.user?.fullName || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">IC Number</span>
                          <span className="text-white">
                            {selectedApplication.user?.icNumber || selectedApplication.user?.idNumber || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Email</span>
                          <span className="text-white">
                            {selectedApplication.user?.email || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Phone</span>
                          <span className="text-white">
                            {selectedApplication.user?.phoneNumber || "N/A"}
                          </span>
                        </div>
                        {selectedApplication.user?.nationality && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Nationality</span>
                            <span className="text-white">
                              {selectedApplication.user.nationality}
                            </span>
                          </div>
                        )}
                        {selectedApplication.user?.race && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Race</span>
                            <span className="text-white">
                              {selectedApplication.user.race}
                            </span>
                          </div>
                        )}
                        {selectedApplication.user?.gender && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Gender</span>
                            <span className="text-white">
                              {selectedApplication.user.gender}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Employment Section */}
                      {(selectedApplication.user?.employmentStatus || selectedApplication.user?.employerName || selectedApplication.user?.monthlyIncome || selectedApplication.user?.occupation || selectedApplication.user?.educationLevel) && (
                        <div className="border-t border-gray-600/50 pt-3 mb-4">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Employment</p>
                          <div className="space-y-2 text-sm">
                            {selectedApplication.user?.employmentStatus && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Status</span>
                                <span className="text-white">
                                  {selectedApplication.user.employmentStatus}
                                </span>
                              </div>
                            )}
                            {selectedApplication.user?.occupation && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Occupation</span>
                                <span className="text-white">
                                  {selectedApplication.user.occupation}
                                </span>
                              </div>
                            )}
                            {selectedApplication.user?.employerName && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Employer</span>
                                <span className="text-white">
                                  {selectedApplication.user.employerName}
                                </span>
                              </div>
                            )}
                            {selectedApplication.user?.serviceLength && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Length of Service</span>
                                <span className="text-white">
                                  {selectedApplication.user.serviceLength} years
                                </span>
                              </div>
                            )}
                            {selectedApplication.user?.monthlyIncome && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Monthly Income</span>
                                <span className="text-emerald-400 font-medium">
                                  {formatCurrency(parseFloat(selectedApplication.user.monthlyIncome))}
                                </span>
                              </div>
                            )}
                            {selectedApplication.user?.educationLevel && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Education Level</span>
                                <span className="text-white">
                                  {selectedApplication.user.educationLevel}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Address Section */}
                      {(selectedApplication.user?.address1 || selectedApplication.user?.city) && (
                        <div className="border-t border-gray-600/50 pt-3 mb-4">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Address</p>
                          <div className="text-sm text-white">
                            {selectedApplication.user?.address1 && (
                              <p>{selectedApplication.user.address1}</p>
                            )}
                            {selectedApplication.user?.address2 && (
                              <p>{selectedApplication.user.address2}</p>
                            )}
                            {(selectedApplication.user?.city || selectedApplication.user?.state || selectedApplication.user?.zipCode) && (
                              <p>
                                {[
                                  selectedApplication.user?.city,
                                  selectedApplication.user?.state,
                                  selectedApplication.user?.zipCode
                                ].filter(Boolean).join(', ')}
                              </p>
                            )}
                            {selectedApplication.user?.country && (
                              <p>{selectedApplication.user.country}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Bank Details */}
                      {(selectedApplication.user?.bankName || selectedApplication.user?.accountNumber) && (
                        <div className="border-t border-gray-600/50 pt-3 mb-4">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Bank Details</p>
                          <div className="space-y-2 text-sm">
                            {selectedApplication.user?.bankName && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Bank</span>
                                <span className="text-white">
                                  {selectedApplication.user.bankName}
                                </span>
                              </div>
                            )}
                            {selectedApplication.user?.accountNumber && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-400">Account No.</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-mono">
                                    {selectedApplication.user.accountNumber}
                                  </span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(selectedApplication.user?.accountNumber || '');
                                      toast.success("Account number copied to clipboard");
                                    }}
                                    className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-400/20 hover:bg-blue-500/30"
                                    title="Copy"
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Emergency Contact */}
                      {(selectedApplication.user?.emergencyContactName || selectedApplication.user?.emergencyContactPhone) && (
                        <div className="border-t border-gray-600/50 pt-3">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Emergency Contact</p>
                          <div className="space-y-2 text-sm">
                            {selectedApplication.user?.emergencyContactName && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Name</span>
                                <span className="text-white">
                                  {selectedApplication.user.emergencyContactName}
                                </span>
                              </div>
                            )}
                            {selectedApplication.user?.emergencyContactRelationship && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Relationship</span>
                                <span className="text-white">
                                  {selectedApplication.user.emergencyContactRelationship}
                                </span>
                              </div>
                            )}
                            {selectedApplication.user?.emergencyContactPhone && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Phone</span>
                                <span className="text-white">
                                  {selectedApplication.user.emergencyContactPhone}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Loan Information */}
                    <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
                      <h4 className="text-lg font-medium text-white mb-3 flex items-center">
                        <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-400" />
                        Loan Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-400">Product:</span>{" "}
                          <span className="text-white">
                            {selectedApplication.product?.name || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Amount:</span>{" "}
                          <span className="text-white">
                            {selectedApplication.amount
                              ? formatCurrency(selectedApplication.amount)
                              : "Not specified"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Term:</span>{" "}
                          <span className="text-white">
                            {selectedApplication.term
                              ? `${selectedApplication.term} months`
                              : "Not specified"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Purpose:</span>{" "}
                          <span className="text-white">
                            {selectedApplication.purpose || "Not specified"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Applied On:</span>{" "}
                          <span className="text-white">
                            {formatDate(selectedApplication.createdAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Last Updated:</span>{" "}
                          <span className="text-white">
                            {formatDate(selectedApplication.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Details - Full width breakdown */}
                    <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50 md:col-span-2">
                      <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                        <BanknotesIcon className="h-5 w-5 mr-2 text-emerald-400" />
                        Financial Breakdown
                      </h4>
                      
                      <div className="space-y-4">
                        {/* Loan Terms Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex justify-between md:flex-col md:justify-start">
                            <span className="text-gray-400">Loan Amount</span>
                            <span className="text-white font-medium md:mt-1">
                              {selectedApplication.amount
                                ? formatCurrency(selectedApplication.amount)
                                : "Not specified"}
                            </span>
                          </div>
                          <div className="flex justify-between md:flex-col md:justify-start">
                            <span className="text-gray-400">Loan Term</span>
                            <span className="text-white font-medium md:mt-1">
                              {selectedApplication.term
                                ? `${selectedApplication.term} months`
                                : "Not specified"}
                            </span>
                          </div>
                          <div className="flex justify-between md:flex-col md:justify-start">
                            <span className="text-gray-400">Interest Rate</span>
                            <span className="text-white font-medium md:mt-1">
                              {selectedApplication.interestRate
                                ? `${selectedApplication.interestRate}% monthly`
                                : "Not specified"}
                            </span>
                          </div>
                          <div className="flex justify-between md:flex-col md:justify-start">
                            <span className="text-gray-400">Monthly Repayment</span>
                            <span className="text-purple-400 font-semibold md:mt-1">
                              {selectedApplication.monthlyRepayment
                                ? formatCurrency(selectedApplication.monthlyRepayment)
                                : "Not calculated"}
                            </span>
                          </div>
                        </div>

                        {/* Fees Breakdown */}
                        <div className="border-t border-gray-600/50 pt-4">
                          <p className="text-sm font-medium text-gray-300 mb-3">Fees Deducted at Disbursement</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400">Legal Fee</span>
                              <span className="text-red-400">
                                - {selectedApplication.legalFeeFixed !== undefined && selectedApplication.legalFeeFixed !== null && selectedApplication.legalFeeFixed > 0
                                  ? formatCurrency(selectedApplication.legalFeeFixed)
                                  : "RM 0.00"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400">Stamping Fee</span>
                              <span className="text-red-400">
                                - {selectedApplication.stampingFee !== undefined && selectedApplication.stampingFee !== null && selectedApplication.stampingFee > 0
                                  ? formatCurrency(selectedApplication.stampingFee)
                                  : "RM 0.00"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-gray-600/30">
                              <span className="text-gray-300 font-medium">Total Fees</span>
                              <span className="text-red-400 font-medium">
                                - {formatCurrency(
                                  (selectedApplication.legalFeeFixed || 0) + 
                                  (selectedApplication.stampingFee || 0)
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Net Disbursement - Highlighted */}
                        <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/30">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-emerald-400 font-medium">Net Disbursement</p>
                              <p className="text-xs text-gray-400 mt-0.5">Amount credited to borrower's account</p>
                            </div>
                            <span className="text-emerald-400 text-xl font-semibold">
                              {selectedApplication.netDisbursement
                                ? formatCurrency(selectedApplication.netDisbursement)
                                : selectedApplication.amount
                                  ? formatCurrency(
                                      selectedApplication.amount - 
                                      (selectedApplication.legalFeeFixed || 0) - 
                                      (selectedApplication.stampingFee || 0)
                                    )
                                  : "Not calculated"}
                            </span>
                          </div>
                        </div>

                        {/* Late Payment Fees from Product */}
                        {selectedApplication.product && (
                          <div className="border-t border-gray-600/50 pt-4">
                            <p className="text-sm font-medium text-gray-300 mb-3">Late Payment Fees</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                                <span className="text-gray-400 block text-xs mb-1">Late Fee Rate</span>
                                <span className="text-amber-400 font-medium">
                                  {selectedApplication.product.lateFeeRate !== undefined && selectedApplication.product.lateFeeRate !== null
                                    ? `${selectedApplication.product.lateFeeRate}%`
                                    : "8%"} <span className="text-xs text-gray-400">per annum</span>
                                </span>
                              </div>
                              <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                                <span className="text-gray-400 block text-xs mb-1">Fixed Late Fee</span>
                                <span className="text-amber-400 font-medium">
                                  {selectedApplication.product.lateFeeFixedAmount !== undefined && selectedApplication.product.lateFeeFixedAmount !== null
                                    ? formatCurrency(selectedApplication.product.lateFeeFixedAmount)
                                    : "RM 0.00"}
                                </span>
                                {selectedApplication.product.lateFeeFrequencyDays !== undefined && selectedApplication.product.lateFeeFrequencyDays !== null && selectedApplication.product.lateFeeFrequencyDays > 0 && (
                                  <span className="text-xs text-gray-400 block mt-1">every {selectedApplication.product.lateFeeFrequencyDays} days</span>
                                )}
                              </div>
                              <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                                <span className="text-gray-400 block text-xs mb-1">Grace Period</span>
                                <span className="text-amber-400 font-medium">
                                  {lateFeeGraceDays} days
                                </span>
                                <span className="text-xs text-gray-400 block mt-1">before fee applies</span>
                                <span className="text-xs text-blue-400 block mt-0.5">(system-wide)</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Documents Tab - ADMIN only */}
                {selectedTab === "documents" && userRole === "ADMIN" && (
                  <div className="space-y-6">
                    {/* Document Summary */}
                    {(() => {
                      // Normalize document types - remove surrounding quotes if present
                      const normalizeDocType = (docType: string | unknown): string => {
                        if (typeof docType !== 'string') return String(docType);
                        // Remove surrounding quotes that may come from JSON storage
                        return docType.replace(/^["']|["']$/g, '').trim();
                      };
                      
                      const rawRequiredDocs = selectedApplication.product?.requiredDocuments || [];
                      const requiredDocs = rawRequiredDocs.map(normalizeDocType);
                      const uploadedDocs = selectedApplication.documents || [];
                      const uploadedDocTypes = Array.from(new Set(uploadedDocs.map(d => normalizeDocType(d.type))));
                      const missingDocs = requiredDocs.filter((docType: string) => !uploadedDocTypes.includes(docType));
                      const hasAllDocs = missingDocs.length === 0 && requiredDocs.length > 0;
                      const isCollateralLoan = selectedApplication.product?.collateralRequired === true;
                      
                      return (
                        <>
                          {/* Summary Banner */}
                          <div className={`rounded-lg p-4 border ${
                            isCollateralLoan 
                              ? "bg-amber-500/10 border-amber-500/30"
                              : hasAllDocs 
                                ? "bg-green-500/10 border-green-500/30" 
                                : requiredDocs.length === 0
                                  ? "bg-gray-700/30 border-gray-600/30"
                                  : "bg-amber-500/10 border-amber-500/30"
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                {isCollateralLoan ? (
                                  <ClipboardDocumentCheckIcon className="h-5 w-5 text-amber-400 mr-2" />
                                ) : hasAllDocs ? (
                                  <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
                                ) : requiredDocs.length === 0 ? (
                                  <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
                                ) : (
                                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mr-2" />
                                )}
                                <div>
                                  <p className={`font-medium ${
                                    isCollateralLoan 
                                      ? "text-amber-200"
                                      : hasAllDocs 
                                        ? "text-green-200" 
                                        : requiredDocs.length === 0
                                          ? "text-gray-300"
                                          : "text-amber-200"
                                  }`}>
                                    {isCollateralLoan 
                                      ? "Collateral Loan - Documents Optional"
                                      : hasAllDocs 
                                        ? "All Required Documents Uploaded" 
                                        : requiredDocs.length === 0
                                          ? "No Required Documents for this Product"
                                          : `${missingDocs.length} of ${requiredDocs.length} Required Documents Missing`}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {uploadedDocs.length} document{uploadedDocs.length !== 1 ? 's' : ''} uploaded
                                    {requiredDocs.length > 0 && ` • ${requiredDocs.length} required by product`}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Required Documents Checklist */}
                          {requiredDocs.length > 0 && (
                            <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
                              <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                                <ClipboardDocumentCheckIcon className="h-5 w-5 mr-2 text-blue-400" />
                                Required Documents
                              </h4>
                              <div className="space-y-3">
                                {requiredDocs.map((docType: string) => {
                                  const uploadedForType = uploadedDocs.filter(d => normalizeDocType(d.type) === docType);
                                  const hasUpload = uploadedForType.length > 0;
                                  const allApproved = hasUpload && uploadedForType.every(d => d.status === 'APPROVED');
                                  const hasRejected = hasUpload && uploadedForType.some(d => d.status === 'REJECTED');
                                  
                                  return (
                                    <div key={docType} className="border border-gray-700/40 rounded-lg p-3 bg-gray-800/30">
                                      <div className="flex justify-between items-start">
                                        <div className="flex items-start">
                                          <div className={`mt-0.5 mr-3 rounded-full p-1 ${
                                            allApproved 
                                              ? "bg-green-500/20" 
                                              : hasRejected 
                                                ? "bg-red-500/20"
                                                : hasUpload 
                                                  ? "bg-amber-500/20" 
                                                  : "bg-gray-600/20"
                                          }`}>
                                            {allApproved ? (
                                              <CheckCircleIcon className="h-4 w-4 text-green-400" />
                                            ) : hasRejected ? (
                                              <XCircleIcon className="h-4 w-4 text-red-400" />
                                            ) : hasUpload ? (
                                              <ClockIcon className="h-4 w-4 text-amber-400" />
                                            ) : (
                                              <XMarkIcon className="h-4 w-4 text-gray-500" />
                                            )}
                                          </div>
                                          <div>
                                            <p className="text-white font-medium">{getDocumentTypeName(docType)}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                              {!hasUpload 
                                                ? "Not uploaded" 
                                                : allApproved 
                                                  ? `${uploadedForType.length} file(s) approved`
                                                  : hasRejected
                                                    ? "Needs re-upload"
                                                    : `${uploadedForType.length} file(s) pending review`}
                                            </p>
                                          </div>
                                        </div>
                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                          allApproved 
                                            ? "bg-green-500/20 text-green-200 border border-green-400/30"
                                            : hasRejected 
                                              ? "bg-red-500/20 text-red-200 border border-red-400/30"
                                              : hasUpload 
                                                ? "bg-amber-500/20 text-amber-200 border border-amber-400/30"
                                                : "bg-gray-600/20 text-gray-400 border border-gray-500/30"
                                        }`}>
                                          {allApproved ? "Approved" : hasRejected ? "Rejected" : hasUpload ? "Pending" : "Missing"}
                                        </span>
                                      </div>
                                      
                                      {/* Show uploaded files for this type */}
                                      {hasUpload && (
                                        <div className="mt-3 pl-8 space-y-2">
                                          {uploadedForType.map((doc) => (
                                            <div key={doc.id} className="flex items-center justify-between text-sm bg-gray-700/30 rounded px-3 py-2">
                                              <span className="text-gray-300 truncate max-w-[200px]">
                                                {doc.fileUrl.split('/').pop()}
                                              </span>
                                              <div className="flex items-center space-x-2">
                                                <span className={`px-1.5 py-0.5 text-xs rounded ${
                                                  getDocumentStatusColor(doc.status).bg
                                                } ${getDocumentStatusColor(doc.status).text}`}>
                                                  {doc.status}
                                                </span>
                                                <a
                                                  href={formatDocumentUrl(doc.fileUrl, doc.id)}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-xs px-2 py-1 bg-blue-500/20 text-blue-200 rounded border border-blue-400/20 hover:bg-blue-500/30"
                                                >
                                                  View
                                                </a>
                                                <button
                                                  onClick={() => handleDocumentStatusChange(doc.id, "APPROVED")}
                                                  disabled={doc.status === "APPROVED"}
                                                  className={`text-xs px-2 py-1 rounded border ${
                                                    doc.status === "APPROVED"
                                                      ? "bg-gray-700/50 text-gray-400 border-gray-600/50 cursor-not-allowed"
                                                      : "bg-green-500/20 text-green-200 border-green-400/20 hover:bg-green-500/30"
                                                  }`}
                                                >
                                                  ✓
                                                </button>
                                                <button
                                                  onClick={() => handleDocumentStatusChange(doc.id, "REJECTED")}
                                                  disabled={doc.status === "REJECTED"}
                                                  className={`text-xs px-2 py-1 rounded border ${
                                                    doc.status === "REJECTED"
                                                      ? "bg-gray-700/50 text-gray-400 border-gray-600/50 cursor-not-allowed"
                                                      : "bg-red-500/20 text-red-200 border-red-400/20 hover:bg-red-500/30"
                                                  }`}
                                                >
                                                  ✗
                                                </button>
                                                <button
                                                  onClick={() => handleAdminDocumentDelete(doc.id)}
                                                  className="text-xs px-2 py-1 rounded border bg-gray-600/20 text-gray-300 border-gray-500/30 hover:bg-red-500/20 hover:text-red-200 hover:border-red-400/30"
                                                  title="Delete document"
                                                >
                                                  🗑
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {/* Upload button for missing or additional documents */}
                                      <div className="mt-3 pl-8">
                                        <label className="relative cursor-pointer">
                                          <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            className="hidden"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                handleAdminDocumentUpload(docType, file);
                                                e.target.value = ''; // Reset input
                                              }
                                            }}
                                            disabled={uploadingDocument === docType}
                                          />
                                          <span className={`inline-flex items-center text-xs px-3 py-1.5 rounded border transition-colors ${
                                            uploadingDocument === docType
                                              ? "bg-gray-600/50 text-gray-400 border-gray-500/30 cursor-wait"
                                              : "bg-purple-500/20 text-purple-200 border-purple-400/30 hover:bg-purple-500/30"
                                          }`}>
                                            {uploadingDocument === docType ? (
                                              <>
                                                <svg className="animate-spin h-3 w-3 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Uploading...
                                              </>
                                            ) : (
                                              <>
                                                <ArrowUpTrayIcon className="h-3 w-3 mr-1.5" />
                                                {hasUpload ? "Add More" : "Upload"}
                                              </>
                                            )}
                                          </span>
                                        </label>
                                        {documentUploadError && uploadingDocument === null && (
                                          <p className="text-xs text-red-400 mt-1">{documentUploadError}</p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Additional Documents (uploaded but not in required list) */}
                          {(() => {
                            const additionalDocs = uploadedDocs.filter(
                              (doc) => !requiredDocs.includes(normalizeDocType(doc.type))
                            );
                            if (additionalDocs.length === 0) return null;
                            
                            return (
                              <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50">
                                <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                                  <DocumentTextIcon className="h-5 w-5 mr-2 text-purple-400" />
                                  Additional Documents
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {additionalDocs.map((doc) => (
                                    <div
                                      key={doc.id}
                                      className="border border-gray-700/40 rounded-lg p-3 bg-gray-800/30"
                                    >
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-white">
                                          {getDocumentTypeName(doc.type)}
                                        </span>
                                        <span
                                          className={`px-2 py-1 text-xs rounded-full ${
                                            getDocumentStatusColor(doc.status).bg
                                          } ${getDocumentStatusColor(doc.status).text}`}
                                        >
                                          {doc.status}
                                        </span>
                                      </div>
                                      <div className="flex space-x-2 mt-2">
                                        <a
                                          href={formatDocumentUrl(doc.fileUrl, doc.id)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs px-2 py-1 bg-blue-500/20 text-blue-200 rounded border border-blue-400/20 hover:bg-blue-500/30"
                                        >
                                          View
                                        </a>
                                        <button
                                          onClick={() => handleDocumentStatusChange(doc.id, "APPROVED")}
                                          disabled={doc.status === "APPROVED"}
                                          className={`text-xs px-2 py-1 rounded border ${
                                            doc.status === "APPROVED"
                                              ? "bg-gray-700/50 text-gray-400 border-gray-600/50"
                                              : "bg-green-500/20 text-green-200 border-green-400/20 hover:bg-green-500/30"
                                          }`}
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => handleDocumentStatusChange(doc.id, "REJECTED")}
                                          disabled={doc.status === "REJECTED"}
                                          className={`text-xs px-2 py-1 rounded border ${
                                            doc.status === "REJECTED"
                                              ? "bg-gray-700/50 text-gray-400 border-gray-600/50"
                                              : "bg-red-500/20 text-red-200 border-red-400/20 hover:bg-red-500/30"
                                          }`}
                                        >
                                          Reject
                                        </button>
                                        <button
                                          onClick={() => handleAdminDocumentDelete(doc.id)}
                                          className="text-xs px-2 py-1 rounded border bg-gray-600/20 text-gray-300 border-gray-500/30 hover:bg-red-500/20 hover:text-red-200 hover:border-red-400/30"
                                          title="Delete document"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* No Documents Message */}
                          {uploadedDocs.length === 0 && requiredDocs.length === 0 && (
                            <div className="border border-gray-700/50 rounded-lg p-8 bg-gray-800/50 text-center">
                              <DocumentTextIcon className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                              <p className="text-gray-400">No documents uploaded for this application</p>
                              <p className="text-xs text-gray-500 mt-1">This product does not require any documents</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Audit Trail Tab - ADMIN only */}
                {selectedTab === "audit" && userRole === "ADMIN" && (
                  <div>
                    {/* Audit Trail Section */}
                    <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50 mb-6">
                      <h4 className="text-lg font-medium text-white mb-3 flex items-center">
                        <ClipboardDocumentCheckIcon className="h-5 w-5 mr-2 text-purple-400" />
                        Audit Trail
                      </h4>
                      {/* Color Legend */}
                      <div className="flex flex-wrap gap-4 text-xs mb-4">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                          <span className="text-gray-400">System Actions</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-amber-400 rounded-full mr-2"></div>
                          <span className="text-gray-400">Admin Actions</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                          <span className="text-gray-400">
                            Customer Actions
                          </span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-cyan-400 rounded-full mr-2"></div>
                          <span className="text-gray-400">Document Changes</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {selectedApplication.history &&
                        selectedApplication.history.length > 0 ? (
                          <div className="space-y-3">
                            {selectedApplication.history
                              .sort(
                                (a, b) =>
                                  new Date(b.createdAt).getTime() -
                                  new Date(a.createdAt).getTime()
                              )
                              .map((historyItem, index) => (
                                <div
                                  key={historyItem.id}
                                  className="flex items-start space-x-3 p-4 bg-gray-800/30 rounded-lg border border-gray-700/30"
                                >
                                  <div className="flex-shrink-0 mt-1">
                                    <div
                                      className={`w-2 h-2 rounded-full ${
                                        // Document-related events get cyan color
                                        historyItem.newStatus === 'DOCUMENT_UPLOADED' ||
                                        historyItem.newStatus === 'DOCUMENT_DELETED' ||
                                        historyItem.newStatus === 'DOCUMENT_APPROVED' ||
                                        historyItem.newStatus === 'DOCUMENT_REJECTED' ||
                                        historyItem.newStatus === 'DOCUMENT_STATUS_CHANGED' ||
                                        historyItem.changeReason?.includes('DOCUMENT')
                                          ? "bg-cyan-400"
                                          : historyItem.changedBy
                                              ?.toLowerCase()
                                              .includes("system")
                                          ? "bg-blue-400"
                                          : historyItem.changedBy &&
                                            (historyItem.changedBy.startsWith(
                                              "admin_"
                                            ) ||
                                              historyItem.changeReason
                                                ?.toLowerCase()
                                                .includes("admin") ||
                                              historyItem.notes
                                                ?.toLowerCase()
                                                .includes("admin"))
                                          ? "bg-amber-400"
                                          : "bg-purple-500"
                                      }`}
                                    ></div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium text-white">
                                        {getHistoryActionDescription(
                                          historyItem.previousStatus,
                                          historyItem.newStatus,
                                          historyItem.changeReason
                                        )}
                                      </p>
                                      <p className="text-xs text-gray-400">
                                        {new Date(
                                          historyItem.createdAt
                                        ).toLocaleDateString("en-US", {
                                          year: "numeric",
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                      Changed by:{" "}
                                      {historyItem.changedBy || "System"}
                                    </p>
                                    {historyItem.notes && (
                                      <div className="mt-2 p-2 bg-gray-700/50 rounded text-xs text-gray-300">
                                        <span className="font-medium">
                                          Notes:
                                        </span>{" "}
                                        {historyItem.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <ClockIcon className="mx-auto h-10 w-10 text-gray-500 mb-2" />
                            <p className="text-gray-400">
                              No history available for this application
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Signatures Tab */}
                {selectedTab === "signatures" && (
                  <div>
                    {loadingSignatures ? (
                      <div className="flex items-center justify-center py-8">
                        <ArrowPathIcon className="h-6 w-6 animate-spin text-blue-400 mr-2" />
                        <span className="text-gray-400">
                          Loading signature status...
                        </span>
                      </div>
                    ) : signaturesData ? (
                      <div>
                        <div className="mb-6">
                          <h4 className="text-white font-medium mb-4 flex items-center">
                            <PencilSquareIcon className="h-5 w-5 mr-2 text-purple-400" />
                            Document Signature Status
                          </h4>
                          <div className="bg-gray-800/30 rounded-lg border border-gray-700/30 p-4 mb-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-400">Borrower:</span>
                                <span className="text-white ml-2">
                                  {signaturesData.borrowerName}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Email:</span>
                                <span className="text-white ml-2">
                                  {signaturesData.borrowerEmail}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">
                                  Application Status:
                                </span>
                                <span className="text-white ml-2">
                                  {signaturesData.loanStatus}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">
                                  Agreement Status:
                                </span>
                                <span className="text-white ml-2">
                                  {signaturesData.agreementStatus}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {signaturesData.signatures &&
                          signaturesData.signatures.length > 0 ? (
                            signaturesData.signatures.map((signature: any) => (
                              <div
                                key={signature.id}
                                className="bg-gray-800/30 rounded-lg border border-gray-700/30 p-4"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center mb-2">
                                      <div className="flex-1">
                                        <h5 className="text-white font-medium">
                                          {signature.type === "USER" &&
                                            "👤 Borrower"}
                                          {signature.type === "COMPANY" &&
                                            "🏢 Company"}
                                          {signature.type === "WITNESS" &&
                                            "⚖️ Witness"}
                                        </h5>
                                        {/* Only show name/email subtext for borrower */}
                                        {signature.type === "USER" && (
                                          <p className="text-gray-400 text-sm">
                                            {signature.name} ({signature.email})
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center">
                                        {signature.status === "SIGNED" ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-800/20 text-green-400 border border-green-800/30">
                                            <CheckCircleIcon className="h-3 w-3 mr-1" />
                                            Signed
                                          </span>
                                        ) : signature.status === "PENDING" ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-800/20 text-yellow-400 border border-yellow-800/30">
                                            <ClockIcon className="h-3 w-3 mr-1" />
                                            Pending
                                          </span>
                                        ) : signature.status ===
                                          "PENDING_PKI_SIGNING" ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-800/20 text-purple-400 border border-purple-800/30">
                                            <ClockIcon className="h-3 w-3 mr-1" />
                                            Pending PKI Signing
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-800/20 text-red-400 border border-red-800/30">
                                            <XMarkIcon className="h-3 w-3 mr-1" />
                                            {signature.status}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {signature.signedAt && (
                                      <p className="text-gray-400 text-xs">
                                        Signed:{" "}
                                        {new Date(
                                          signature.signedAt
                                        ).toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                  <div className="ml-4">
                                    {signature.canSign ? (
                                      // Hide company signing button for ATTESTOR users
                                      userRole === "ATTESTOR" &&
                                      signature.type === "COMPANY" ? (
                                        <span className="text-gray-500 text-xs">
                                          Admin access required
                                        </span>
                                      ) : signature.status === "PENDING" &&
                                        signature.signingUrl ? (
                                        // PENDING status: Complete DocuSeal (for all signatory types)
                                        <a
                                          href={signature.signingUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-yellow-600 text-white hover:bg-yellow-700 transition-colors"
                                        >
                                          <PencilSquareIcon className="h-3 w-3 mr-1" />
                                          Sign Document
                                        </a>
                                      ) : signature.status ===
                                        "PENDING_PKI_SIGNING" ? (
                                        // PENDING_PKI_SIGNING status: Sign with PKI/PIN
                                        signature.type === "USER" ? (
                                          // For USER signatures, redirect to PKI signing page
                                          <a
                                            href={`/pki-signing?submissionId=${signaturesData?.docusealSubmissionId}&applicationId=${selectedApplication?.id}`}
                                            className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                          >
                                            <PencilSquareIcon className="h-3 w-3 mr-1" />
                                            Complete Signing
                                          </a>
                                        ) : (
                                          // For COMPANY and WITNESS signatures, redirect to PKI signing page
                                          <a
                                            href={`/pki-signing?application=${
                                              selectedApplication?.id
                                            }&signatory=${signature.type.toLowerCase()}`}
                                            className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                                          >
                                            <PencilSquareIcon className="h-3 w-3 mr-1" />
                                            Complete Signing
                                          </a>
                                        )
                                      ) : (
                                        <span className="text-gray-500 text-xs">
                                          No action available
                                        </span>
                                      )
                                    ) : signature.status === "SIGNED" ? (
                                      <span className="text-gray-500 text-xs">
                                        {/* Status already shown above */}
                                      </span>
                                    ) : (
                                      <span className="text-gray-500 text-xs">
                                        No action available
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="bg-gray-800/30 rounded-lg border border-gray-700/30 p-8 text-center">
                              <PencilSquareIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                              <p className="text-gray-400">
                                No signature records found for this application.
                              </p>
                              <p className="text-gray-500 text-sm mt-1">
                                Signature tracking may not be enabled for this
                                application.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-800/30 rounded-lg border border-gray-700/30 p-8 text-center">
                        <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                        <p className="text-gray-400">
                          Unable to load signature status.
                        </p>
                        <p className="text-gray-500 text-sm mt-1">
                          Please try refreshing the page.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Approval Tab */}
                {selectedTab === "approval" && (
                  <div className="space-y-6">
                    {/* Navigation Hint */}
                    <div className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                      <InformationCircleIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-gray-300">
                        <p className="mb-2">Before making a decision, please review:</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setSelectedTab("details")}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors border border-blue-500/30"
                          >
                            <UserCircleIcon className="h-4 w-4" />
                            Details Tab
                          </button>
                          <button
                            onClick={() => setSelectedTab("documents")}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors border border-blue-500/30"
                          >
                            <FolderIcon className="h-4 w-4" />
                            Documents Tab
                          </button>
                          {userRole === "ADMIN" && (
                            <button
                              onClick={() => setSelectedTab("credit-report")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg transition-colors border border-cyan-500/30"
                            >
                              <ShieldCheckIcon className="h-4 w-4" />
                              Credit Report
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Credit Decision Card */}
                    <div className="border border-amber-500/30 rounded-xl p-6 bg-gradient-to-br from-amber-500/10 to-amber-600/5">
                      <h4 className="text-lg font-semibold text-white mb-5 flex items-center">
                        <DocumentMagnifyingGlassIcon className="h-6 w-6 mr-2 text-amber-400" />
                        Credit Decision
                      </h4>

                      {/* Application Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Applicant</p>
                          <p className="text-white font-medium">{selectedApplication.user?.fullName || "—"}</p>
                          <p className="text-sm text-gray-400 mt-1">{selectedApplication.user?.email}</p>
                          {/* IC Number with inline edit */}
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500">IC:</span>
                            {!editingIcNumber ? (
                              <>
                                <span className="text-sm text-white font-mono">
                                  {selectedApplication.user?.icNumber || selectedApplication.user?.idNumber || "Not set"}
                                </span>
                                <button
                                  onClick={() => {
                                    setIcNumberValue(
                                      selectedApplication.user?.icNumber || 
                                      selectedApplication.user?.idNumber || 
                                      ""
                                    );
                                    setEditingIcNumber(true);
                                  }}
                                  className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
                                  title="Edit IC Number"
                                >
                                  <PencilSquareIcon className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={icNumberValue}
                                  onChange={(e) => setIcNumberValue(e.target.value)}
                                  placeholder="Enter IC number"
                                  className="flex-1 px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500 font-mono"
                                  disabled={updatingIcNumber}
                                />
                                <button
                                  onClick={() => {
                                    if (selectedApplication?.userId) {
                                      updateUserIcNumber(selectedApplication.userId, icNumberValue);
                                    }
                                  }}
                                  disabled={updatingIcNumber || !icNumberValue.trim()}
                                  className="p-1 text-green-400 hover:text-green-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Save"
                                >
                                  {updatingIcNumber ? (
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircleIcon className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingIcNumber(false);
                                    setIcNumberValue("");
                                  }}
                                  disabled={updatingIcNumber}
                                  className="p-1 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Cancel"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Loan Request</p>
                          <p className="text-2xl font-bold text-amber-400">
                            {selectedApplication.amount
                              ? formatCurrency(selectedApplication.amount)
                              : "—"}
                          </p>
                          <p className="text-sm text-gray-400 mt-1">
                            {selectedApplication.term
                              ? `${selectedApplication.term} months • ${selectedApplication.product?.name || "Unknown Product"}`
                              : "Term not set"}
                          </p>
                        </div>
                      </div>

                      {/* Decision Notes */}
                      <div className="mb-5">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Decision Notes <span className="text-gray-500 font-normal">(Optional)</span>
                        </label>
                        <textarea
                          value={decisionNotes}
                          onChange={(e) => setDecisionNotes(e.target.value)}
                          placeholder="Add notes about your decision..."
                          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                          rows={2}
                        />
                      </div>

                      {/* Decision Buttons */}
                      {isLoanDisbursed(selectedApplication) ? (
                        <div className="p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
                          <div className="flex items-center">
                            <CheckCircleIcon className="h-6 w-6 text-blue-400 mr-3" />
                            <div>
                              <p className="text-blue-200 font-medium">Loan Already Disbursed</p>
                              <p className="text-blue-300/70 text-sm">This loan has been disbursed and cannot be modified.</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            onClick={() => handleApprovalDecision("approve")}
                            disabled={processingDecision}
                            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/30 disabled:shadow-none"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                            {processingDecision ? "Processing..." : "Approve Application"}
                          </button>
                          <button
                            onClick={() => handleApprovalDecision("reject")}
                            disabled={processingDecision}
                            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-all"
                          >
                            <XCircleIcon className="h-5 w-5" />
                            {processingDecision ? "Processing..." : "Reject Application"}
                          </button>
                        </div>
                      )}

                      {/* Workflow Info */}
                      <div className="mt-5 flex items-start gap-2 text-xs text-gray-500">
                        <InformationCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <p>
                          <strong className="text-green-400">Approve</strong> → Moves to signing • 
                          <strong className="text-red-400 ml-1">Reject</strong> → Marks as rejected & notifies user
                        </p>
                      </div>
                    </div>

                    {/* Counter Offer Section */}
                    <div className="border border-purple-500/30 rounded-xl overflow-hidden">
                      <div 
                        className={`p-5 bg-gradient-to-br from-purple-500/10 to-purple-600/5 ${!showFreshOfferForm ? 'cursor-pointer hover:from-purple-500/15' : ''}`}
                        onClick={() => !showFreshOfferForm && populateFreshOfferForm()}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                              <ArrowsUpDownIcon className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                              <h5 className="text-base font-semibold text-white">Counter Offer</h5>
                              <p className="text-xs text-gray-400 mt-0.5">Propose alternative loan terms to the applicant</p>
                            </div>
                          </div>
                          {!showFreshOfferForm && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                populateFreshOfferForm();
                              }}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              Create Counter Offer
                            </button>
                          )}
                        </div>
                      </div>

                      {showFreshOfferForm && (
                        <div className="p-5 pt-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-t border-purple-500/20">
                          <div className="space-y-5 mt-5">
                            {/* Product Selection */}
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Product
                              </label>
                              <select
                                value={freshOfferProductId}
                                onChange={(e) => setFreshOfferProductId(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-800/70 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              >
                                <option value="">Select product</option>
                                {products.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name} - {product.interestRate}% interest
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Basic Loan Terms */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                  Amount (RM)
                                </label>
                                <input
                                  type="number"
                                  value={freshOfferAmount}
                                  onChange={(e) => setFreshOfferAmount(e.target.value)}
                                  placeholder="Enter amount"
                                  className="w-full px-4 py-3 bg-gray-800/70 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  step="0.01"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                  Term (months)
                                </label>
                                <input
                                  type="number"
                                  value={freshOfferTerm}
                                  onChange={(e) => setFreshOfferTerm(e.target.value)}
                                  placeholder="Enter term"
                                  className="w-full px-4 py-3 bg-gray-800/70 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                  Interest Rate (%)
                                </label>
                                <input
                                  type="number"
                                  value={freshOfferInterestRate}
                                  onChange={(e) => setFreshOfferInterestRate(e.target.value)}
                                  placeholder="Enter rate"
                                  className="w-full px-4 py-3 bg-gray-800/70 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  step="0.01"
                                />
                              </div>
                            </div>

                            {/* Fee Structure */}
                            <div className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-4">
                                <h6 className="text-sm font-medium text-gray-300">
                                  Fee Structure
                                </h6>
                                {!feeEditMode ? (
                                  <button
                                    onClick={handleEditFees}
                                    className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-md transition-colors"
                                  >
                                    Edit Fees
                                  </button>
                                ) : (
                                  <button
                                    onClick={handleSaveFees}
                                    className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors"
                                  >
                                    Save Fees
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Legal Fee (Fixed Amount - RM)
                                  </label>
                                  {products.find((p) => p.id === freshOfferProductId) && (
                                    <p className="text-xs text-gray-400 mb-2">
                                      Auto: RM{products.find((p) => p.id === freshOfferProductId)?.legalFeeFixed} fixed
                                    </p>
                                  )}
                                  <input
                                    type="number"
                                    value={freshOfferLegalFeeFixed}
                                    onChange={(e) => handleFeeChange("legalFixed", e.target.value)}
                                    disabled={!feeEditMode}
                                    placeholder="Auto-calculated"
                                    className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                                      feeEditMode
                                        ? "bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        : "bg-gray-700/50 border-gray-600/50 text-gray-400 cursor-not-allowed"
                                    }`}
                                    step="0.01"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Stamping Fee (RM)
                                  </label>
                                  {products.find((p) => p.id === freshOfferProductId) && (
                                    <p className="text-xs text-gray-400 mb-2">
                                      Auto: {products.find((p) => p.id === freshOfferProductId)?.stampingFee}% of loan amount
                                    </p>
                                  )}
                                  <input
                                    type="number"
                                    value={freshOfferStampingFee}
                                    onChange={(e) => handleFeeChange("stamping", e.target.value)}
                                    disabled={!feeEditMode}
                                    placeholder="Auto-calculated"
                                    className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                                      feeEditMode
                                        ? "bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        : "bg-gray-700/50 border-gray-600/50 text-gray-400 cursor-not-allowed"
                                    }`}
                                    step="0.01"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Calculated Values */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                  Monthly Repayment (RM)
                                </label>
                                <input
                                  type="number"
                                  value={freshOfferMonthlyRepayment}
                                  readOnly
                                  placeholder="Auto-calculated"
                                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-500 rounded-lg text-gray-300 placeholder-gray-500 cursor-not-allowed"
                                  step="0.01"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                  Net Disbursement (RM)
                                </label>
                                <input
                                  type="number"
                                  value={freshOfferNetDisbursement}
                                  readOnly
                                  placeholder="Auto-calculated"
                                  className="w-full px-3 py-2 bg-gray-700/50 border border-gray-500 rounded-lg text-gray-300 placeholder-gray-500 cursor-not-allowed"
                                  step="0.01"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Notes <span className="text-gray-500 font-normal">(Optional)</span>
                              </label>
                              <textarea
                                value={freshOfferNotes}
                                onChange={(e) => setFreshOfferNotes(e.target.value)}
                                placeholder="Explain the reason for the counter offer..."
                                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                rows={2}
                              />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                              <button
                                onClick={handleFreshOfferSubmission}
                                disabled={processingFreshOffer}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 disabled:shadow-none"
                              >
                                {processingFreshOffer ? (
                                  <>
                                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <ArrowsUpDownIcon className="h-5 w-5" />
                                    Send Counter Offer
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => setShowFreshOfferForm(false)}
                                disabled={processingFreshOffer}
                                className="px-6 py-3.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-medium rounded-xl transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Credit Report Tab - ADMIN only */}
                {selectedTab === "credit-report" && userRole === "ADMIN" && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/20 rounded-lg">
                          <ShieldCheckIcon className="h-6 w-6 text-cyan-400" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-white">Credit Report (CTOS)</h4>
                          <p className="text-sm text-gray-400">
                            View or fetch credit report for {selectedApplication.user?.fullName}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Applicant Summary */}
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Applicant</p>
                          <p className="text-white font-medium">{selectedApplication.user?.fullName || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">IC Number</p>
                          <p className="text-white font-mono">{selectedApplication.user?.icNumber || selectedApplication.user?.idNumber || "Not set"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Loan Amount</p>
                          <p className="text-white font-medium">
                            {selectedApplication.amount ? formatCurrency(selectedApplication.amount) : "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Credit Report Card */}
                    <CreditReportCard
                      userId={selectedApplication.userId}
                      applicationId={selectedApplication.id}
                      userFullName={selectedApplication.user?.fullName || ""}
                      userIcNumber={selectedApplication.user?.icNumber || selectedApplication.user?.idNumber}
                      existingReport={creditReport}
                      onReportFetched={(report) => {
                        setCreditReport(report);
                        if (selectedApplication) {
                          fetchApplications();
                        }
                      }}
                      onRequestConfirmation={(onConfirm) => {
                        showConfirmModal({
                          title: "Request Fresh Credit Report",
                          message: "Are you sure you want to request a fresh credit report from CTOS?",
                          details: [
                            `Applicant: ${selectedApplication.user?.fullName || "Unknown"}`,
                            `IC Number: ${selectedApplication.user?.icNumber || selectedApplication.user?.idNumber || "Not set"}`,
                            "",
                            "⚠️ This will charge company credits.",
                          ],
                          confirmText: "Request Report",
                          confirmColor: "blue",
                          onConfirm: () => {
                            closeConfirmModal();
                            onConfirm();
                          },
                        });
                      }}
                    />

                    {/* Back to Approval */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => setSelectedTab("approval")}
                        className="inline-flex items-center gap-2 px-4 py-2 text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back to Approval Decision
                      </button>
                    </div>
                  </div>
                )}

                {/* Collateral Review Tab */}
                {selectedTab === "collateral" && (
                  <div>
                    {/* Collateral Review Section */}
                    <div className="border border-amber-500/30 rounded-lg p-6 bg-amber-500/10 mb-6">
                      <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                        <ClipboardDocumentCheckIcon className="h-6 w-6 mr-2 text-amber-400" />
                        Collateral Review Decision
                      </h4>

                      {/* Application Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-800/50 rounded-lg">
                        <div>
                          <h5 className="text-sm font-medium text-gray-300 mb-2">
                            Applicant
                          </h5>
                          <p className="text-white">
                            {selectedApplication.user?.fullName}
                          </p>
                          <p className="text-sm text-gray-400">
                            {selectedApplication.user?.email}
                          </p>
                          
                          {/* IC Number Section */}
                          <div className="mt-2 flex items-center gap-2">
                            {!editingIcNumber ? (
                              <>
                                <p className="text-sm text-gray-400">
                                  IC: {selectedApplication.user?.icNumber || selectedApplication.user?.idNumber || "Not set"}
                                </p>
                                <button
                                  onClick={() => {
                                    setIcNumberValue(
                                      selectedApplication.user?.icNumber || 
                                      selectedApplication.user?.idNumber || 
                                      ""
                                    );
                                    setEditingIcNumber(true);
                                  }}
                                  className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                                  title="Edit IC Number"
                                >
                                  <PencilSquareIcon className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={icNumberValue}
                                  onChange={(e) => setIcNumberValue(e.target.value)}
                                  placeholder="Enter IC number"
                                  className="flex-1 px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                                  disabled={updatingIcNumber}
                                />
                                <button
                                  onClick={() => {
                                    if (selectedApplication?.userId) {
                                      updateUserIcNumber(selectedApplication.userId, icNumberValue);
                                    }
                                  }}
                                  disabled={updatingIcNumber || !icNumberValue.trim()}
                                  className="p-1 text-green-400 hover:text-green-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Save IC Number"
                                >
                                  {updatingIcNumber ? (
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircleIcon className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingIcNumber(false);
                                    setIcNumberValue("");
                                  }}
                                  disabled={updatingIcNumber}
                                  className="p-1 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Cancel"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-gray-300 mb-2">
                            Loan Details
                          </h5>
                          <p className="text-white">
                            {selectedApplication.amount
                              ? formatCurrency(selectedApplication.amount)
                              : "Amount not set"}
                          </p>
                          <p className="text-sm text-gray-400">
                            {selectedApplication.term
                              ? `${selectedApplication.term} months`
                              : "Term not set"}
                          </p>
                        </div>
                      </div>

                      {/* Collateral Information */}
                      <div className="mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                        <h5 className="text-sm font-medium text-amber-200 mb-2">
                          Collateral Loan Information
                        </h5>
                        <p className="text-xs text-amber-200/80">
                          This is a collateral-backed loan that requires manual
                          review of the collateral details before approval.
                          Please review all collateral documentation and
                          valuation before making a decision.
                        </p>
                      </div>

                      {/* Decision Notes */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Review Notes (Optional)
                        </label>
                        <textarea
                          value={collateralNotes}
                          onChange={(e) => setCollateralNotes(e.target.value)}
                          placeholder="Add notes about your collateral review decision..."
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          rows={3}
                        />
                      </div>

                      {/* Decision Buttons */}
                      {isLoanDisbursed(selectedApplication) ? (
                        <div className="p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
                          <div className="flex items-center">
                            <CheckCircleIcon className="h-6 w-6 text-blue-400 mr-3" />
                            <div>
                              <p className="text-blue-200 font-medium">
                                Loan Already Disbursed
                              </p>
                              <p className="text-blue-300/70 text-sm">
                                This loan has been disbursed and cannot be
                                modified.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex space-x-4">
                          <button
                            onClick={() => handleCollateralDecision("approve")}
                            disabled={processingCollateral}
                            className="flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-medium rounded-lg transition-colors"
                          >
                            <CheckCircleIcon className="h-5 w-5 mr-2" />
                            {processingCollateral
                              ? "Processing..."
                              : "Approve Collateral & Proceed to Disbursement"}
                          </button>
                          <button
                            onClick={() => handleCollateralDecision("reject")}
                            disabled={processingCollateral}
                            className="flex items-center px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-medium rounded-lg transition-colors"
                          >
                            <XCircleIcon className="h-5 w-5 mr-2" />
                            {processingCollateral
                              ? "Processing..."
                              : "Reject Application"}
                          </button>
                        </div>
                      )}

                      {/* Workflow Information */}
                      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
                        <h5 className="text-sm font-medium text-blue-200 mb-2">
                          Next Steps
                        </h5>
                        <ul className="text-xs text-blue-200 space-y-1">
                          <li>
                            • <strong>Approve:</strong> Application will move to
                            PENDING_DISBURSEMENT status for fund transfer
                          </li>
                          <li>
                            • <strong>Reject:</strong> Application will be
                            marked as REJECTED and user will be notified
                          </li>
                          <li>
                            • All collateral review decisions are logged in the
                            audit trail with timestamps
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Disbursement Tab */}
                {selectedTab === "disbursement" && (
                  <div className="space-y-6">
                    {/* Transfer Details Card */}
                    <div className="border border-green-500/30 rounded-xl p-6 bg-gradient-to-br from-green-500/10 to-green-600/5">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-lg font-semibold text-white flex items-center">
                          <BanknotesIcon className="h-6 w-6 mr-2 text-green-400" />
                          Transfer Details
                        </h4>
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full border border-green-500/30">
                          Ready to Disburse
                        </span>
                      </div>

                      {/* Amount Highlight */}
                      <div className="bg-gray-900/50 rounded-lg p-4 mb-6 text-center">
                        <p className="text-sm text-gray-400 mb-1">Net Disbursement Amount</p>
                        <p className="text-3xl font-bold text-green-400">
                          {selectedApplication.netDisbursement
                            ? formatCurrency(selectedApplication.netDisbursement)
                            : selectedApplication.amount
                            ? formatCurrency(selectedApplication.amount)
                            : "Not set"}
                        </p>
                        {selectedApplication.netDisbursement && selectedApplication.amount && 
                          selectedApplication.netDisbursement !== selectedApplication.amount && (
                          <p className="text-xs text-gray-500 mt-1">
                            Principal: {formatCurrency(selectedApplication.amount)}
                          </p>
                        )}
                      </div>

                      {/* Bank Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Recipient</p>
                          <p className="text-white font-medium">{selectedApplication.user?.fullName || "—"}</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bank</p>
                          <p className="text-white font-medium">{selectedApplication.user?.bankName || "Not provided"}</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-4 md:col-span-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Account Number</p>
                              <p className="text-white font-mono text-lg">{selectedApplication.user?.accountNumber || "Not provided"}</p>
                            </div>
                            {selectedApplication.user?.accountNumber && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(selectedApplication.user?.accountNumber || "");
                                  toast.success("Account number copied to clipboard");
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium rounded-lg transition-colors border border-blue-500/30"
                              >
                                <ClipboardDocumentCheckIcon className="h-4 w-4" />
                                Copy
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Reference Number Input */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Bank Transfer Reference
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={disbursementReference}
                            onChange={(e) => setDisbursementReference(e.target.value)}
                            placeholder="Enter or use auto-generated reference..."
                            className="flex-1 px-4 py-3 bg-gray-800/70 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                          />
                          <button
                            onClick={() => {
                              if (disbursementReference) {
                                navigator.clipboard.writeText(disbursementReference);
                                toast.success("Reference number copied to clipboard");
                              }
                            }}
                            disabled={!disbursementReference}
                            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors"
                            title="Copy reference"
                          >
                            <ClipboardDocumentCheckIcon className="h-5 w-5" />
                          </button>
                        </div>
                        {disbursementReference && (
                          <p className="text-xs text-gray-500 mt-2">
                            Use this reference when making the bank transfer
                          </p>
                        )}
                      </div>

                      {/* Notes (Collapsible feel - smaller) */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Notes <span className="text-gray-500 font-normal">(Optional)</span>
                        </label>
                        <textarea
                          value={disbursementNotes}
                          onChange={(e) => setDisbursementNotes(e.target.value)}
                          placeholder="Add any notes about this disbursement..."
                          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                          rows={2}
                        />
                      </div>

                      {/* Disburse Button */}
                      <button
                        onClick={handleDisbursement}
                        disabled={processingDisbursement || !disbursementReference.trim()}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/30 disabled:shadow-none"
                      >
                        {processingDisbursement ? (
                          <>
                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                            Processing Disbursement...
                          </>
                        ) : (
                          <>
                            <BanknotesIcon className="h-5 w-5" />
                            Disburse Loan
                          </>
                        )}
                      </button>
                      {!disbursementReference.trim() && (
                        <p className="text-xs text-center text-amber-400 mt-2">
                          Enter a reference number to enable disbursement
                        </p>
                      )}
                    </div>

                    {/* Info Card */}
                    <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                      <div className="flex items-start gap-3">
                        <InformationCircleIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-gray-400 space-y-1">
                          <p>After disbursement, the loan becomes <span className="text-green-400 font-medium">ACTIVE</span> and repayment schedule is generated automatically.</p>
                          <p>You can upload the payment slip from the <span className="text-blue-400">Loans</span> page after completing the bank transfer.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stamping Tab */}
                {selectedTab === "stamping" && (
                  <div>
                    {/* Stamping Section */}
                    <div className="border border-teal-500/30 rounded-lg p-6 bg-teal-500/10 mb-6">
                      <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                        <DocumentTextIcon className="h-6 w-6 mr-2 text-teal-400" />
                        Stamp Certificate Upload
                      </h4>

                      {/* Application Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-800/50 rounded-lg">
                        <div>
                          <h5 className="text-sm font-medium text-gray-300 mb-2">
                            Applicant
                          </h5>
                          <p className="text-white">
                            {selectedApplication.user?.fullName}
                          </p>
                          <p className="text-sm text-gray-400">
                            {selectedApplication.user?.email}
                          </p>
                          
                          {/* IC Number Section */}
                          <div className="mt-2 flex items-center gap-2">
                            {!editingIcNumber ? (
                              <>
                                <p className="text-sm text-gray-400">
                                  IC: {selectedApplication.user?.icNumber || selectedApplication.user?.idNumber || "Not set"}
                                </p>
                                <button
                                  onClick={() => {
                                    setIcNumberValue(
                                      selectedApplication.user?.icNumber || 
                                      selectedApplication.user?.idNumber || 
                                      ""
                                    );
                                    setEditingIcNumber(true);
                                  }}
                                  className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                                  title="Edit IC Number"
                                >
                                  <PencilSquareIcon className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={icNumberValue}
                                  onChange={(e) => setIcNumberValue(e.target.value)}
                                  placeholder="Enter IC number"
                                  className="flex-1 px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                                  disabled={updatingIcNumber}
                                />
                                <button
                                  onClick={() => {
                                    if (selectedApplication?.userId) {
                                      updateUserIcNumber(selectedApplication.userId, icNumberValue);
                                    }
                                  }}
                                  disabled={updatingIcNumber || !icNumberValue.trim()}
                                  className="p-1 text-green-400 hover:text-green-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Save IC Number"
                                >
                                  {updatingIcNumber ? (
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircleIcon className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingIcNumber(false);
                                    setIcNumberValue("");
                                  }}
                                  disabled={updatingIcNumber}
                                  className="p-1 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Cancel"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-gray-300 mb-2">
                            Loan Details
                          </h5>
                          <p className="text-white">
                            {selectedApplication.amount
                              ? formatCurrency(selectedApplication.amount)
                              : "Amount not set"}
                          </p>
                          <p className="text-sm text-gray-400">
                            {selectedApplication.term
                              ? `${selectedApplication.term} months`
                              : "Term not set"}
                          </p>
                        </div>
                      </div>

                      {/* Document Download Section */}
                      <div className="mb-6 p-4 bg-gray-800/30 rounded-lg">
                        <h5 className="text-white font-medium mb-3">
                          Download Loan Documents
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(
                                  `/api/admin/applications/${selectedApplication.id}/signed-agreement`,
                                  {
                                    method: "GET",
                                    headers: {
                                      Authorization: `Bearer ${localStorage.getItem(
                                        "adminToken"
                                      )}`,
                                    },
                                  }
                                );

                                if (!response.ok) {
                                  throw new Error(
                                    "Failed to download signed agreement"
                                  );
                                }

                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `signed-agreement-${selectedApplication.id.substring(
                                  0,
                                  8
                                )}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              } catch (error) {
                                console.error(
                                  "Error downloading signed agreement:",
                                  error
                                );
                                toast.error("Failed to download signed agreement");
                              }
                            }}
                            className="flex items-center justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                          >
                            <CheckCircleIcon className="h-4 w-4 mr-2" />
                            Signed Agreement
                          </button>
                          {selectedApplication.loan?.pkiStampCertificateUrl && (
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch(
                                    `/api/admin/applications/${selectedApplication.id}/stamp-certificate`,
                                    {
                                      method: "GET",
                                      headers: {
                                        Authorization: `Bearer ${localStorage.getItem(
                                          "adminToken"
                                        )}`,
                                      },
                                    }
                                  );

                                  if (!response.ok) {
                                    throw new Error(
                                      "Failed to download stamp certificate"
                                    );
                                  }

                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `stamp-certificate-${selectedApplication.id.substring(
                                    0,
                                    8
                                  )}.pdf`;
                                  document.body.appendChild(a);
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                  document.body.removeChild(a);
                                } catch (error) {
                                  console.error(
                                    "Error downloading stamp certificate:",
                                    error
                                  );
                                  toast.error("Failed to download stamp certificate");
                                }
                              }}
                              className="flex items-center justify-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                            >
                              <DocumentTextIcon className="h-4 w-4 mr-2" />
                              Stamp Certificate
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Stamp Certificate Upload */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Upload Stamp Certificate (PDF)
                        </label>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(e) =>
                            setStampCertificateFile(e.target.files?.[0] || null)
                          }
                          className="block w-full text-sm text-gray-300
												file:mr-4 file:py-2 file:px-4
												file:rounded-lg file:border-0
												file:text-sm file:font-semibold
												file:bg-teal-600 file:text-white
												hover:file:bg-teal-700
												cursor-pointer"
                          disabled={
                            uploadingStampCertificate ||
                            (!!selectedApplication.loan
                              ?.pkiStampCertificateUrl &&
                              !replacingStampCertificate)
                          }
                        />
                        {stampCertificateFile && (
                          <p className="mt-2 text-sm text-gray-400">
                            Selected: {stampCertificateFile.name} (
                            {(stampCertificateFile.size / 1024 / 1024).toFixed(
                              2
                            )}{" "}
                            MB)
                          </p>
                        )}
                        {selectedApplication.loan?.pkiStampCertificateUrl &&
                          !replacingStampCertificate && (
                            <div className="mt-2 flex items-center space-x-3">
                              <p className="text-sm text-green-400">
                                ✓ Stamp certificate already uploaded
                              </p>
                              <button
                                onClick={() => {
                                  showConfirmModal({
                                    title: "Replace Certificate",
                                    message: "Are you sure you want to replace the existing stamp certificate?",
                                    details: ["The current certificate will be overwritten."],
                                    confirmText: "Replace Certificate",
                                    confirmColor: "amber",
                                    onConfirm: () => {
                                      closeConfirmModal();
                                      setReplacingStampCertificate(true);
                                      setStampCertificateFile(null);
                                    },
                                  });
                                }}
                                className="text-xs px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors"
                              >
                                Replace Certificate
                              </button>
                            </div>
                          )}
                        {replacingStampCertificate && (
                          <div className="mt-2 flex items-center space-x-3">
                            <p className="text-sm text-yellow-400">
                              ⚠ Replacing certificate - select new file above
                            </p>
                            <button
                              onClick={() => {
                                setReplacingStampCertificate(false);
                                setStampCertificateFile(null);
                              }}
                              className="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Upload Button */}
                      {(!selectedApplication.loan?.pkiStampCertificateUrl ||
                        replacingStampCertificate) && (
                        <div className="flex space-x-4 mb-6">
                          <button
                            onClick={async () => {
                              if (!stampCertificateFile) {
                                toast.warning("Please select a stamp certificate file");
                                return;
                              }

                              setUploadingStampCertificate(true);
                              try {
                                const formData = new FormData();
                                formData.append(
                                  "stampCertificate",
                                  stampCertificateFile
                                );

                                const loanId = selectedApplication.loan?.id;

                                if (!loanId) {
                                  toast.error(
                                    "Missing loan ID. Please refresh and ensure the application has a linked loan."
                                  );
                                  return;
                                }

                                const response = await fetch(
                                  `/api/admin/loans/${loanId}/upload-stamp-certificate`,
                                  {
                                    method: "POST",
                                    headers: {
                                      Authorization: `Bearer ${localStorage.getItem(
                                        "adminToken"
                                      )}`,
                                    },
                                    body: formData,
                                  }
                                );

                                if (!response.ok) {
                                  const error = await response.json();
                                  throw new Error(
                                    error.message || "Upload failed"
                                  );
                                }

                                const data = await response.json();

                                const certificateUrl =
                                  data?.data?.stampCertificateUrl ||
                                  data?.data?.certificateUrl;

                                if (!certificateUrl) {
                                  console.warn(
                                    "No certificate URL returned from upload response.",
                                    data
                                  );
                                }

                                // Update selected application immediately with the new certificate URL
                                const updatedSelectedApp = {
                                  ...selectedApplication,
                                  loan: {
                                    ...selectedApplication.loan,
                                    pkiStampCertificateUrl:
                                      certificateUrl ||
                                      selectedApplication.loan
                                        ?.pkiStampCertificateUrl ||
                                      null,
                                  },
                                };
                                setSelectedApplication(
                                  updatedSelectedApp as any
                                );
                                setStampCertificateUploaded(true);
                                setReplacingStampCertificate(false);

                                // Refresh application data
                                await fetchApplications();

                                const message = replacingStampCertificate
                                  ? 'Stamp certificate replaced! Click "Confirm Stamping & Proceed to Disbursement" to continue.'
                                  : 'Stamp certificate uploaded! Click "Confirm Stamping & Proceed to Disbursement" to continue.';
                                toast.success(message);
                              } catch (error) {
                                console.error(
                                  "Error uploading stamp certificate:",
                                  error
                                );
                                toast.error(
                                  `Failed to upload stamp certificate: ${
                                    error instanceof Error
                                      ? error.message
                                      : "Unknown error"
                                  }`
                                );
                              } finally {
                                setUploadingStampCertificate(false);
                              }
                            }}
                            disabled={
                              uploadingStampCertificate || !stampCertificateFile
                            }
                            className="flex items-center px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 text-white font-medium rounded-lg transition-colors"
                          >
                            {uploadingStampCertificate
                              ? "Uploading..."
                              : replacingStampCertificate
                              ? "Replace Stamp Certificate"
                              : "Upload Stamp Certificate"}
                          </button>
                        </div>
                      )}

                      {/* Confirm Stamping Button */}
                      {selectedApplication.loan?.pkiStampCertificateUrl &&
                        !replacingStampCertificate && (
                          <div className="flex space-x-4">
                            <button
                              onClick={() => {
                                showConfirmModal({
                                  title: "Confirm Stamping",
                                  message: `Are you sure you want to confirm stamping for this application?`,
                                  details: [
                                    `Applicant: ${selectedApplication.user?.fullName || "Unknown"}`,
                                    "This will move the application to PENDING_DISBURSEMENT status",
                                    "Loan disbursement will be enabled after confirmation",
                                  ],
                                  confirmText: "Confirm Stamping",
                                  confirmColor: "green",
                                  onConfirm: async () => {
                                    closeConfirmModal();
                                    setConfirmingStamping(true);
                                    try {
                                      const response = await fetch(
                                        `/api/admin/applications/${selectedApplication.id}/confirm-stamping`,
                                        {
                                          method: "POST",
                                          headers: {
                                            Authorization: `Bearer ${localStorage.getItem(
                                              "adminToken"
                                            )}`,
                                            "Content-Type": "application/json",
                                          },
                                        }
                                      );

                                      const data = await response.json();

                                      if (!response.ok) {
                                        throw new Error(
                                          data.message || "Confirmation failed"
                                        );
                                      }

                                      toast.success(
                                        "Stamping confirmed! Application moved to PENDING_DISBURSEMENT."
                                      );

                                      // Update selected application status to trigger disbursement reference generation
                                      const updatedApp = {
                                        ...selectedApplication,
                                        status: "PENDING_DISBURSEMENT",
                                      };
                                      setSelectedApplication(updatedApp as any);

                                      // Generate disbursement reference immediately
                                      const reference = `DISB-${selectedApplication.id
                                        .slice(-8)
                                        .toUpperCase()}-${Date.now().toString().slice(-6)}`;
                                      setDisbursementReference(reference);

                                      // Refresh application data
                                      await fetchApplications();
                                      setSelectedTab("disbursement");
                                      setSelectedFilters(["PENDING_DISBURSEMENT"]);
                                      router.push("/dashboard/applications?filter=pending-disbursement");
                                    } catch (error) {
                                      console.error(
                                        "❌ Error confirming stamping:",
                                        error
                                      );
                                      toast.error(
                                        `Failed to confirm stamping: ${
                                          error instanceof Error
                                            ? error.message
                                            : "Unknown error"
                                        }`
                                      );
                                    } finally {
                                      setConfirmingStamping(false);
                                    }
                                  },
                                });
                              }}
                              disabled={confirmingStamping}
                              className="flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-medium rounded-lg transition-colors"
                            >
                              <CheckCircleIcon className="h-5 w-5 mr-2" />
                              {confirmingStamping
                                ? "Confirming..."
                                : "Confirm Stamping & Proceed to Disbursement"}
                            </button>
                          </div>
                        )}

                      {/* Workflow Information */}
                      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
                        <h5 className="text-sm font-medium text-blue-200 mb-2">
                          Stamping Process
                        </h5>
                        <ul className="text-xs text-blue-200 space-y-1">
                          <li>
                            • All parties have completed digital PKI signing
                          </li>
                          <li>• Download and review the signed agreement</li>
                          <li>
                            • Upload the official stamp certificate (PDF format,
                            max 10MB)
                          </li>
                          <li>
                            • Confirm stamping to proceed to disbursement stage
                          </li>
                          <li>
                            • Once confirmed, the application status will change
                            to PENDING_DISBURSEMENT
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions Tab - ADMIN only */}
                {selectedTab === "actions" && userRole === "ADMIN" && (
                  <div>
                    {/* Update Status Section */}
                    <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/50 mb-6">
                      <h4 className="text-lg font-medium text-white mb-3">
                        Update Application Status
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        {[
                          "INCOMPLETE",
                          "PENDING_APP_FEE",
                          "PENDING_KYC",
                          "PENDING_APPROVAL",
                          "PENDING_ATTESTATION",
                          "PENDING_SIGNATURE",
                          "PENDING_DISBURSEMENT",
                          "COLLATERAL_REVIEW",
                          "REJECTED",
                          "WITHDRAWN",
                        ].map((status) => (
                          <button
                            key={status}
                            onClick={() =>
                              handleStatusChange(selectedApplication.id, status)
                            }
                            disabled={selectedApplication.status === status}
                            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                              selectedApplication.status === status
                                ? "bg-gray-700/50 text-gray-400 border-gray-600/50 cursor-not-allowed"
                                : `${getStatusColor(status)} hover:opacity-80`
                            }`}
                          >
                            {getStatusLabel(status)}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 p-3 bg-blue-500/10 border border-blue-400/20 rounded-lg">
                        <p className="text-xs text-blue-200 mb-2">
                          <span className="font-medium">Note:</span> For
                          applications requiring credit decision or
                          disbursement, specialized tabs will appear above for
                          streamlined processing.
                        </p>
                        {selectedApplication.status === "PENDING_APPROVAL" && (
                          <p className="text-xs text-amber-200 mt-1">
                            • This application is ready for credit decision -
                            check the "Approval" tab
                          </p>
                        )}
                        {selectedApplication.status ===
                          "PENDING_DISBURSEMENT" && (
                          <p className="text-xs text-green-200 mt-1">
                            • This application is ready for disbursement - check
                            the "Disbursement" tab
                          </p>
                        )}
                        {selectedApplication.status === "COLLATERAL_REVIEW" && (
                          <p className="text-xs text-amber-200 mt-1">
                            • This collateral loan requires review - use the
                            approval buttons above
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Advanced Actions */}
                    <div className="flex justify-end space-x-3">
                      {/* Skip button for automated advancement */}
                      {selectedApplication.status !== "PENDING_SIGNATURE" &&
                        selectedApplication.status !== "REJECTED" &&
                        selectedApplication.status !== "WITHDRAWN" &&
                        selectedApplication.status !== "PENDING_APPROVAL" &&
                        selectedApplication.status !== "PENDING_DISBURSEMENT" &&
                        selectedApplication.status !== "COLLATERAL_REVIEW" && (
                          <button
                            onClick={() => {
                              // Determine next status based on current status
                              let nextStatus = "";
                              switch (selectedApplication.status) {
                                case "INCOMPLETE":
                                  nextStatus = "PENDING_APP_FEE";
                                  break;
                                case "PENDING_APP_FEE":
                                  nextStatus = "PENDING_KYC";
                                  break;
                                case "PENDING_KYC":
                                  nextStatus = "PENDING_APPROVAL";
                                  break;
                                default:
                                  return;
                              }

                              if (nextStatus) {
                                handleStatusChange(
                                  selectedApplication.id,
                                  nextStatus
                                );
                              }
                            }}
                            className="flex items-center px-4 py-2 bg-blue-600/40 text-blue-100 rounded-lg border border-blue-500/40 hover:bg-blue-600/60 transition-colors"
                          >
                            <ArrowRightIcon className="h-4 w-4 mr-2" />
                            Advance to Next Step
                          </button>
                        )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 backdrop-blur-md border border-gray-700/30 rounded-xl shadow-lg h-full flex items-center justify-center p-8">
              <div className="text-center">
                <DocumentTextIcon className="mx-auto h-16 w-16 text-gray-500" />
                <h3 className="mt-4 text-xl font-medium text-white">
                  No Application Selected
                </h3>
                <p className="mt-2 text-gray-400">
                  Select an application from the list to view its details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PIN signing now handled in separate admin PKI page */}

      {/* Actions Tab Warning Modal */}
      {showActionsWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowActionsWarningModal(false)}
          />
          {/* Modal */}
          <div className="relative bg-gray-900 border border-red-500/50 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Warning Header */}
            <div className="bg-red-500/20 border-b border-red-500/30 px-6 py-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-red-500/20 rounded-full p-2">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
                </div>
                <h3 className="ml-3 text-lg font-semibold text-red-400">
                  Warning: Developer Actions
                </h3>
              </div>
            </div>
            {/* Content */}
            <div className="px-6 py-5">
              <div className="space-y-4">
                <p className="text-gray-300">
                  This tab contains <span className="font-semibold text-red-400">dangerous actions</span> that can break compliance and audit trails.
                </p>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <ul className="text-sm text-red-300 space-y-2">
                    <li className="flex items-start">
                      <XCircleIcon className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Manual status changes bypass normal workflow validations</span>
                    </li>
                    <li className="flex items-start">
                      <XCircleIcon className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Actions here may not trigger required notifications</span>
                    </li>
                    <li className="flex items-start">
                      <XCircleIcon className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Audit records may be incomplete or inconsistent</span>
                    </li>
                  </ul>
                </div>
                <p className="text-sm text-gray-400 italic">
                  This tab is intended for <span className="font-medium text-gray-300">testing and development purposes only</span>. 
                  Do not use unless absolutely necessary.
                </p>
              </div>
            </div>
            {/* Actions */}
            <div className="bg-gray-800/50 border-t border-gray-700/50 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowActionsWarningModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowActionsTab(true);
                  setShowActionsWarningModal(false);
                  setSelectedTab("actions");
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 border border-red-500 rounded-lg transition-colors flex items-center"
              >
                <ExclamationTriangleIcon className="h-4 w-4 mr-1.5" />
                I Understand, Show Actions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={confirmModal.open}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        details={confirmModal.details}
        confirmText={confirmModal.confirmText}
        confirmColor={confirmModal.confirmColor}
      />
    </AdminLayout>
  );
}

export default function AdminApplicationsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminApplicationsPageContent />
    </Suspense>
  );
}
