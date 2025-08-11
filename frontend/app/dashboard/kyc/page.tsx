"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { TokenStorage } from "@/lib/authUtils";

function KycPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId");
  const [kycId, setKycId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start or reuse KYC session
  useEffect(() => {
    async function bootstrap() {
      try {
        const token = TokenStorage.getAccessToken();
        if (!token) throw new Error("Missing token");
        const body: any = applicationId ? { applicationId } : {};
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kyc/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to start KYC");
        setKycId(data.kycId);

        // Desktop: show QR to open mobile capture url
        const tokenParam = data.kycToken ? `&t=${encodeURIComponent(data.kycToken)}` : "";
        const mobileUrl = `${window.location.origin}/dashboard/kyc/capture/front?kycId=${data.kycId}${tokenParam}`;
        const url = await QRCode.toDataURL(mobileUrl);
        setQrDataUrl(url);

        // Start polling
        startPolling(data.kycId);
      } catch (e: any) {
        setError(e.message || "Failed to initialize KYC");
      }
    }
    bootstrap();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [applicationId]);

  function startPolling(id: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const token = TokenStorage.getAccessToken();
        if (!token) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kyc/${id}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (["APPROVED", "REJECTED", "MANUAL_REVIEW", "FAILED"].includes(data.status)) {
          clearInterval(pollingRef.current!);
          if (data.status === "APPROVED") router.replace(`/dashboard/kyc/review?kycId=${id}`);
          else router.replace("/dashboard/loans");
        }
      } catch {}
    }, 3000);
  }

  return (
    <div className="min-h-screen bg-offwhite w-full flex items-center justify-center px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden w-full max-w-lg">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-end">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
              title="Back to Dashboard"
              aria-label="Back to Dashboard"
            >
              <XMarkIcon className="h-5 w-5" />
            </Link>
          </div>
          <div className="flex items-center">
            <div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0 border border-purple-primary/20">
              <svg className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">Verify your identity</h1>
              <p className="text-sm lg:text-base text-blue-tertiary font-semibold">Scan the QR with your phone to continue</p>
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>
          )}

          <div className="flex items-center justify-center">
            <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-purple-primary/5 to-blue-tertiary/5 border border-gray-100">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="KYC QR"
                  className="w-56 h-56 sm:w-64 sm:h-64 rounded-xl bg-white border border-gray-100 shadow-sm"
                />
              ) : (
                <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-xl bg-white border border-gray-100 grid place-items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary" />
                </div>
              )}
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm sm:text-base text-gray-600 font-body">Use your mobile phone to complete e-KYC.</p>
            <p className="text-xs sm:text-sm text-gray-500 font-body">Keep this page open — you’ll be redirected when verification is done.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KycPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary" /></div>}>
      <KycPageContent />
    </Suspense>
  );
}


