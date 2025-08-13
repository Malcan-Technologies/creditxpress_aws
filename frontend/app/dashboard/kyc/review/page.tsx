"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TokenStorage } from "@/lib/authUtils";
import KycImageDisplay from "@/components/KycImageDisplay";

interface KycDocument {
  id: string;
  type: "front" | "back" | "selfie";
  storageUrl: string;
  createdAt: string;
}

interface KycDetails {
  kycId: string;
  status: string;
  documents: KycDocument[];
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

  const onRetakeDocument = (documentType: "front" | "back" | "selfie") => {
    if (!kycId) return;
    router.replace(`/dashboard/kyc/capture/${documentType}?kycId=${kycId}${kycToken ? `&t=${encodeURIComponent(kycToken)}` : ''}&retake=true`);
  };

  const onRedoAll = () => {
    if (!kycId) return;
    router.replace(`/dashboard/kyc/capture/front?kycId=${kycId}${kycToken ? `&t=${encodeURIComponent(kycToken)}` : ''}`);
  };

  // Helper to get document by type
  const getDocument = (type: "front" | "back" | "selfie") => {
    return details?.documents?.find(doc => doc.type === type);
  };

  // Helper to render document image
  const renderDocumentImage = (doc: KycDocument, altText: string) => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden h-40">
        <KycImageDisplay imageId={doc.id} />
      </div>
    );
  };

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
              <h1 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">Review your documents</h1>
              <p className="text-sm lg:text-base text-blue-tertiary font-semibold">Check your uploaded documents and retake if needed</p>
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
            <div className="space-y-6">
              {/* Document Images Section */}
              <div className="space-y-4">
                <h2 className="text-base font-heading font-semibold text-gray-700">Uploaded Documents</h2>
                
                {/* MyKad Front */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-gray-700">MyKad (Front)</div>
                    <button 
                      onClick={() => onRetakeDocument("front")}
                      className="text-xs px-3 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Retake
                    </button>
                  </div>
                  {getDocument("front") ? 
                    renderDocumentImage(getDocument("front")!, "MyKad Front") : (
                    <div className="bg-white rounded-lg border border-dashed border-gray-300 h-40 flex items-center justify-center text-gray-500 text-sm">
                      No front image uploaded
                    </div>
                  )}
                </div>

                {/* MyKad Back */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-gray-700">MyKad (Back)</div>
                    <button 
                      onClick={() => onRetakeDocument("back")}
                      className="text-xs px-3 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Retake
                    </button>
                  </div>
                  {getDocument("back") ? 
                    renderDocumentImage(getDocument("back")!, "MyKad Back") : (
                    <div className="bg-white rounded-lg border border-dashed border-gray-300 h-40 flex items-center justify-center text-gray-500 text-sm">
                      No back image uploaded
                    </div>
                  )}
                </div>

                {/* Selfie */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-gray-700">Selfie</div>
                    <button 
                      onClick={() => onRetakeDocument("selfie")}
                      className="text-xs px-3 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Retake
                    </button>
                  </div>
                  {getDocument("selfie") ? 
                    renderDocumentImage(getDocument("selfie")!, "Selfie") : (
                    <div className="bg-white rounded-lg border border-dashed border-gray-300 h-40 flex items-center justify-center text-gray-500 text-sm">
                      No selfie uploaded
                    </div>
                  )}
                </div>
              </div>

              {/* Status Section */}
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                <div className="text-xs text-blue-700">KYC Status</div>
                <div className="text-blue-800 font-medium">Under Review</div>
                <div className="text-xs text-blue-600 mt-1">Review your documents before final submission</div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4">
                <button onClick={onRedoAll} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                  Redo All Documents
                </button>
                <button 
                  disabled={accepting} 
                  onClick={onAccept} 
                  className="px-6 py-2 rounded-xl bg-purple-primary text-white disabled:opacity-50 hover:bg-purple-700 transition-colors"
                >
                  {accepting ? 'Saving…' : 'Save to Profile'}
                </button>
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


