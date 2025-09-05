"use client";
import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TokenStorage } from "@/lib/authUtils";
import KycErrorBoundary from "@/components/KycErrorBoundary";
import { SmartCardCapture } from "@/components/SmartCardCapture";

function CaptureBackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const kycId = params.get("kycId");
  const kycToken = params.get("t");
  const [preview, setPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = useCallback((imageData: string) => {
    setPreview(imageData);
  }, []);

  const handleRetake = () => setPreview(null);

  async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
  }

  const handleContinue = useCallback(async (imageData: string) => {
    try {
      if (!kycId || !imageData) return;
      setIsSubmitting(true);
      setError(null);
      const token = TokenStorage.getAccessToken();
      if (!token && !kycToken) throw new Error("Unauthorized");
      const form = new FormData();
      form.append("back", await dataUrlToFile(imageData, "mykad-back.png"));
      const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kyc/${kycId}/upload`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(kycToken ? { 'X-KYC-TOKEN': kycToken } : {}),
        },
        body: form
      });
      if (!uploadRes.ok) {
        const upData = await uploadRes.json().catch(() => ({}));
        throw new Error(upData?.message || "Upload failed");
      }
      // OCR validation disabled - proceed directly to next step
      const applicationId = params.get('applicationId');
      let nextUrl = `/dashboard/kyc/capture/selfie?kycId=${kycId}`;
      if (kycToken) nextUrl += `&t=${encodeURIComponent(kycToken)}`;
      if (applicationId) nextUrl += `&applicationId=${applicationId}`;
      router.replace(nextUrl);
    } catch (e: any) {
      // Handle unauthorized errors gracefully for QR code flow
      if (e.message === "Unauthorized" || e.message.includes("401") || e.message.includes("403")) {
        // Check if this is a QR code flow (has kycToken but no regular auth token)
        const isQrCodeFlow = kycToken && !TokenStorage.getAccessToken();
        if (isQrCodeFlow) {
          setError("Please complete this step on your web browser where you scanned the QR code.");
        } else {
          setError(e.message || "Failed to upload back image");
        }
      } else {
        setError(e.message || "Failed to upload back image");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [kycId, kycToken, router, params]);

  const backToFront = () => router.replace(`/dashboard/kyc/capture/front?kycId=${kycId}${kycToken ? `&t=${encodeURIComponent(kycToken)}` : ''}`);

  return (
    <div className="min-h-screen bg-offwhite w-full flex items-center justify-center px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden w-full max-w-2xl">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center">
            <div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0 border border-purple-primary/20">
              <svg className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="14" rx="2" ry="2"/>
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">Step 2 of 3 • Capture MyKad (Back)</h1>
              <p className="text-sm lg:text-base text-blue-tertiary font-semibold">Flip your card and capture</p>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>}

          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={backToFront} 
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ← Back to Front
            </button>
          </div>

          <SmartCardCapture
            onCapture={preview ? handleContinue : handleCapture}
            onRetake={handleRetake}
            isSubmitting={isSubmitting}
            preview={preview}
            captureButtonText="Capture Card"
            retakeButtonText="Retake"
            continueButtonText="Continue"
            stepText="Step 2 of 3 • Capture MyKad (Back)"
            instructions={[
              "Flip the card and ensure the text and barcode are in focus.",
              "Keep the card flat; avoid reflections from overhead lights.",
              "Fill the frame and keep edges within the guide."
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default function CaptureBackPage() {
  return (
    <KycErrorBoundary>
      <Suspense fallback={<div className="min-h-screen grid place-items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary" /></div>}>
        <CaptureBackContent />
      </Suspense>
    </KycErrorBoundary>
  );
}


