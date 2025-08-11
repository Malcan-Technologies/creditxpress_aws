"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TokenStorage } from "@/lib/authUtils";
import Webcam from "react-webcam";

function KycCaptureContent() {
  const router = useRouter();
  const params = useSearchParams();
  const kycId = params.get("kycId");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardCamRef = useRef<Webcam | null>(null);
  const selfieCamRef = useRef<Webcam | null>(null);
  const [step, setStep] = useState<number>(1); // 1: front, 2: back, 3: selfie, 4: confirm

  const dataUrlToFile = useCallback(async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
  }, []);

  const captureFront = useCallback(async () => {
    const imageSrc = cardCamRef.current?.getScreenshot();
    if (!imageSrc) return;
    const file = await dataUrlToFile(imageSrc, "mykad-front.png");
    setFront(file);
    setStep(2);
  }, [dataUrlToFile]);

  const captureBack = useCallback(async () => {
    const imageSrc = cardCamRef.current?.getScreenshot();
    if (!imageSrc) return;
    const file = await dataUrlToFile(imageSrc, "mykad-back.png");
    setBack(file);
    setStep(3);
  }, [dataUrlToFile]);

  const captureSelfie = useCallback(async () => {
    const imageSrc = selfieCamRef.current?.getScreenshot();
    if (!imageSrc) return;
    const file = await dataUrlToFile(imageSrc, "selfie.png");
    setSelfie(file);
    setStep(4);
  }, [dataUrlToFile]);

  async function submit() {
    try {
      setIsSubmitting(true);
      setError(null);
      if (!kycId) throw new Error("Missing kycId");
      const token = TokenStorage.getAccessToken();
      if (!token) throw new Error("Unauthorized");
      const form = new FormData();
      if (front) form.append("front", front);
      if (back) form.append("back", back);
      if (selfie) form.append("selfie", selfie);

      const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kyc/${kycId}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      const upData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(upData?.message || "Upload failed");

      const procRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kyc/${kycId}/process`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const proc = await procRes.json();
      if (!procRes.ok) throw new Error(proc?.message || "Processing failed");

      router.replace("/dashboard/loans");
    } catch (e: any) {
      setError(e.message || "Failed to submit KYC");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    const qp = kycId ? `?kycId=${encodeURIComponent(kycId)}` : "";
    router.replace(`/dashboard/kyc/capture/front${qp}`);
  }, [kycId, router]);

  return (
    <div className="min-h-screen bg-offwhite w-full flex items-center justify-center">
      <div className="flex flex-col items-center space-y-3 text-gray-600">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary" />
        <p className="text-sm">Redirecting to step 1…</p>
      </div>
    </div>
  );
}

export default function KycCapturePage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-primary" /></div>}>
      <KycCaptureContent />
    </Suspense>
  );
}


