"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TokenStorage } from "@/lib/authUtils";

interface KycDetails {
  kycId: string;
  status: string;
  ocr?: {
    name?: string;
    fullName?: string;
    icNumber?: string;
    nric?: string;
    dateOfBirth?: string;
    dob?: string;
    address?: string;
  } | null;
  faceMatchScore?: number;
  livenessScore?: number;
}

function KycReviewContent() {
  const router = useRouter();
  const params = useSearchParams();
  const kycId = params.get("kycId");
  const kycToken = params.get("t");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<KycDetails | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        if (!kycId) throw new Error("Missing kycId");
        const token = TokenStorage.getAccessToken();
        if (!token) throw new Error("Unauthorized");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kyc/${kycId}/details`, {
          headers: { Authorization: `Bearer ${token}`, ...(kycToken ? { 'X-KYC-TOKEN': kycToken } : {}) }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to load KYC details");
        setDetails(data);
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [kycId, kycToken]);

  const onAccept = async () => {
    try {
      if (!kycId) return;
      setAccepting(true);
      const token = TokenStorage.getAccessToken();
      if (!token) throw new Error("Unauthorized");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kyc/${kycId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(kycToken ? { 'X-KYC-TOKEN': kycToken } : {}) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to accept');
      router.replace('/dashboard/profile');
    } catch (e: any) {
      setError(e.message || 'Failed to accept');
    } finally {
      setAccepting(false);
    }
  };

  const onRedo = () => {
    if (!kycId) return;
    router.replace(`/dashboard/kyc/capture/front?kycId=${kycId}${kycToken ? `&t=${encodeURIComponent(kycToken)}` : ''}`);
  };

  const name = (details?.ocr as any)?.name || (details?.ocr as any)?.fullName || '';
  const ic = (details?.ocr as any)?.icNumber || (details?.ocr as any)?.ic_number || (details?.ocr as any)?.nric || '';
  const dob = (details?.ocr as any)?.dateOfBirth || (details?.ocr as any)?.dob || '';
  const address = (details?.ocr as any)?.address || '';

  return (
    <div className="min-h-screen bg-offwhite w-full flex items-center justify-center px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden w-full max-w-2xl">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center">
            <div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0 border border-purple-primary/20">
              <svg className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">Review your details</h1>
              <p className="text-sm lg:text-base text-blue-tertiary font-semibold">Confirm the extracted information before saving</p>
            </div>
          </div>

          {loading && (
            <div className="w-full grid place-items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary" />
            </div>
          )}
          {error && !loading && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>
          )}

          {details && !loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-500">Full Name</div>
                  <div className="text-gray-800 font-medium">{name || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-500">IC Number</div>
                  <div className="text-gray-800 font-medium">{ic || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-500">Date of Birth</div>
                  <div className="text-gray-800 font-medium">{dob || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 sm:col-span-2">
                  <div className="text-xs text-gray-500">Address</div>
                  <div className="text-gray-800 font-medium whitespace-pre-wrap">{address || '—'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                  <div className="text-xs text-green-700">KYC Status</div>
                  <div className="text-green-800 font-medium">{details.status}</div>
                </div>
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                  <div className="text-xs text-blue-700">Face Match</div>
                  <div className="text-blue-800 font-medium">{(details.faceMatchScore ?? 0).toFixed(2)}</div>
                </div>
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                  <div className="text-xs text-amber-700">Liveness</div>
                  <div className="text-amber-800 font-medium">{(details.livenessScore ?? 0).toFixed(2)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <button onClick={onRedo} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700">Redo KYC</button>
                <button disabled={accepting} onClick={onAccept} className="px-6 py-2 rounded-xl bg-purple-primary text-white disabled:opacity-50">{accepting ? 'Saving…' : 'Save to Profile'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KycReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary" /></div>}>
      <KycReviewContent />
    </Suspense>
  );
}


