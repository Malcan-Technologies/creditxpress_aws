"use client";
import { Suspense, useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Webcam from "react-webcam";
import { TokenStorage } from "@/lib/authUtils";

function CaptureFrontContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kycId = searchParams.get("kycId");
  const kycToken = searchParams.get("t");
  const cardCamRef = useRef<Webcam | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(() => {
    const image = cardCamRef.current?.getScreenshot();
    if (image) setPreview(image);
  }, []);

  const retake = () => setPreview(null);

  async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
  }

  const next = useCallback(async () => {
    try {
      if (!kycId || !preview) return;
      setIsSubmitting(true);
      setError(null);
      const token = TokenStorage.getAccessToken();
      if (!token && !kycToken) throw new Error("Unauthorized");
      const form = new FormData();
      form.append("front", await dataUrlToFile(preview, "mykad-front.png"));
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
      // Check if this is a retake from review page
      const isRetake = searchParams.get('retake') === 'true';
      if (isRetake) {
        // Return to review page after individual retake
        router.replace(`/dashboard/kyc/review?kycId=${kycId}${kycToken ? `&t=${encodeURIComponent(kycToken)}` : ''}`);
      } else {
        // OCR validation disabled - proceed directly to next step
        router.replace(`/dashboard/kyc/capture/back?kycId=${kycId}${kycToken ? `&t=${encodeURIComponent(kycToken)}` : ''}`);
      }
    } catch (e: any) {
      setError(e.message || "Failed to upload front image");
    } finally {
      setIsSubmitting(false);
    }
  }, [kycId, preview]);

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
              <h1 className="text-lg lg:text-xl font-heading font-bold text-gray-700 mb-1">Step 1 of 3 • Capture MyKad (Front)</h1>
              <p className="text-sm lg:text-base text-blue-tertiary font-semibold">Align your card in the frame and capture</p>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>}

          {!preview ? (
            <>
              <div className="rounded-xl border border-blue-tertiary/20 bg-blue-tertiary/5 px-4 py-3 text-sm text-gray-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Place MyKad on a flat surface with good, even lighting.</li>
                  <li>Fill the frame and keep all four corners visible. Avoid glare.</li>
                  <li>Hold steady for 1–2 seconds before tapping Capture.</li>
                </ul>
              </div>
              <div className="rounded-2xl p-3 bg-gradient-to-br from-purple-primary/5 to-blue-tertiary/5 border border-gray-100">
                <div className="relative aspect-[16/9] bg-black/5 rounded-xl overflow-hidden">
                  <Webcam
                    ref={cardCamRef as any}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.92}
                    videoConstraints={{ facingMode: { ideal: "environment" } }}
                    className="w-full h-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 border-2 border-white/60 rounded-xl" />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={capture} className="px-6 py-2 rounded-xl bg-purple-primary text-white">Capture</button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                <div className="relative aspect-[16/9]">
                  <img src={preview} alt="front" className="absolute inset-0 w-full h-full object-contain" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={retake} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700">Retake</button>
                <button disabled={isSubmitting} onClick={next} className="px-6 py-2 rounded-xl bg-purple-primary text-white disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Continue'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CaptureFrontPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary" /></div>}>
      <CaptureFrontContent />
    </Suspense>
  );
}


