"use client";
import { Suspense, useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Webcam from "react-webcam";
import { TokenStorage } from "@/lib/authUtils";
import KycErrorBoundary from "@/components/KycErrorBoundary";

function CaptureSelfieContent() {
  const router = useRouter();
  const params = useSearchParams();
  const kycId = params.get("kycId");
  const kycToken = params.get("t");
  const selfieRef = useRef<Webcam | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverHint, setServerHint] = useState<{ nextStep?: string; message?: string } | null>(null);

  const capture = useCallback(() => {
    const image = selfieRef.current?.getScreenshot();
    if (image) setPreview(image);
  }, []);

  const retake = () => {
    setPreview(null);
    setError(null);
    setServerHint(null);
  };

  async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
  }

  const finish = useCallback(async () => {
    try {
      if (!kycId || !preview) return;
      setIsSubmitting(true);
      setError(null);
      const token = TokenStorage.getAccessToken();
      if (!token && !kycToken) throw new Error("Unauthorized");
      const form = new FormData();
      form.append("selfie", await dataUrlToFile(preview, "selfie.png"));
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
      // OCR and face validation disabled - proceed directly to processing
      const procRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kyc/${kycId}/process`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(kycToken ? { 'X-KYC-TOKEN': kycToken } : {}),
        },
      });
      const proc = await procRes.json().catch(() => ({}));
      if (!procRes.ok) {
        const msg = proc?.message || "Processing failed";
        setServerHint({ nextStep: proc?.nextStep, message: msg });
        throw new Error(msg);
      }
      // Build the review URL with all necessary parameters
      const applicationId = params.get('applicationId');
      let reviewUrl = `/dashboard/kyc/review?kycId=${kycId}`;
      if (kycToken) reviewUrl += `&t=${encodeURIComponent(kycToken)}`;
      if (applicationId) reviewUrl += `&applicationId=${applicationId}`;
      
      // Go to review page after completion
      router.replace(reviewUrl);
    } catch (e: any) {
      // Handle unauthorized errors gracefully for QR code flow
      if (e.message === "Unauthorized" || e.message.includes("401") || e.message.includes("403")) {
        // Check if this is a QR code flow (has kycToken but no regular auth token)
        const isQrCodeFlow = kycToken && !TokenStorage.getAccessToken();
        if (isQrCodeFlow) {
          setError("Please complete this step on your web browser where you scanned the QR code.");
        } else {
          setError(e.message || "Failed to submit KYC");
        }
      } else {
        setError(e.message || "Failed to submit KYC");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [kycId, preview]);

  const backToICBack = () => router.replace(`/dashboard/kyc/capture/back?kycId=${kycId}`);

  return (
    <div className="min-h-screen bg-offwhite w-full flex items-center justify-center px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden w-full max-w-2xl">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center">
            <div className="w-12 h-12 lg:w-14 lg:h-14 bg-purple-primary/10 rounded-xl flex items-center justify-center mr-3 flex-shrink-0 border border-purple-primary/20">
              <svg className="h-6 w-6 lg:h-7 lg:w-7 text-purple-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">Step 3 of 3 • Capture Selfie</h1>
              <p className="text-sm lg:text-base text-blue-tertiary font-semibold">Position your face clearly and capture</p>
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-3">
              <div>{error}</div>
              {serverHint?.nextStep && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (serverHint.nextStep === 'retake_front') router.push(`/dashboard/kyc/capture/front?kycId=${kycId}`);
                      else if (serverHint.nextStep === 'retake_back') router.push(`/dashboard/kyc/capture/back?kycId=${kycId}`);
                      else router.push(`/dashboard/kyc/capture/selfie?kycId=${kycId}`);
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-primary text-white"
                  >
                    Go to corrective step
                  </button>
                </div>
              )}
            </div>
          )}

          {!preview ? (
            <>
              <div className="rounded-2xl p-3 bg-gradient-to-br from-purple-primary/5 to-blue-tertiary/5 border border-gray-100">
                <div className="relative aspect-square bg-black/5 rounded-full overflow-hidden mx-auto max-w-xs">
                  <Webcam
                    ref={selfieRef as any}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.92}
                    videoConstraints={{ width: 1024, height: 1024, facingMode: { ideal: "user" } }}
                    className="w-full h-full object-contain"
                  />
                  <div className="pointer-events-none absolute inset-0 ring-2 ring-white/70 rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={backToICBack} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700">Back</button>
                <button onClick={capture} className="px-6 py-2 rounded-xl bg-purple-primary text-white">Capture</button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden mx-auto max-w-xs">
                <img src={preview} alt="selfie" className="w-full object-contain" />
              </div>
              <div className="flex items-center justify-between">
                <button onClick={retake} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700">Retake</button>
                <button disabled={isSubmitting} onClick={finish} className="px-6 py-2 rounded-xl bg-purple-primary text-white disabled:opacity-50">{isSubmitting ? 'Submitting...' : 'Finish'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CaptureSelfiePage() {
  return (
    <KycErrorBoundary>
      <Suspense fallback={<div className="min-h-screen grid place-items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary" /></div>}>
        <CaptureSelfieContent />
      </Suspense>
    </KycErrorBoundary>
  );
}


