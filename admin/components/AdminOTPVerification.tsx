"use client";

import { useState, useEffect } from "react";

interface AdminOTPVerificationProps {
  phoneNumber: string;
  onVerificationSuccess: (data: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    phoneNumber: string;
    isOnboardingComplete: boolean;
    onboardingStep: number;
  }) => void;
  onBack?: () => void;
  title?: string;
  description?: string;
}

export default function AdminOTPVerification({
  phoneNumber,
  onVerificationSuccess,
  onBack,
  title = "Verify Your Phone Number",
  description = "We've sent a 6-digit verification code to your WhatsApp",
}: AdminOTPVerificationProps) {
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60); // Start with 60 second cooldown
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
    } else if (resendCooldown === 0 && !canResend) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown, canResend]);

  const handleVerification = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber,
          otp: otpCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to verify OTP");
      }
      onVerificationSuccess(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };
  const handleResendOTP = async () => {
    if (!canResend || resendCooldown > 0) return;

    setResendLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.message || "Failed to resend OTP";
        const waitTimeMatch = errorMessage.match(/wait (\d+) seconds/);

        if (waitTimeMatch) {
          const waitTime = parseInt(waitTimeMatch[1]);
          setResendCooldown(waitTime);
          setCanResend(false);
          setError(
            `Please wait ${waitTime} seconds before requesting a new code`
          );
        } else {
          setError(errorMessage);
        }
        return;
      }

      setResendCooldown(60);
      setCanResend(false);
      setError("New verification code sent to your WhatsApp!");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to resend OTP");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl shadow-xl p-8 space-y-8 border border-gray-700/30">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white font-heading mb-2">
          {title}
        </h2>
        <p className="text-sm text-gray-400 font-body">
          {description}: <span className="font-semibold">{phoneNumber}</span>
        </p>
      </div>
      <form className="space-y-6" onSubmit={handleVerification}>
        <div>
          <label
            htmlFor="otpCode"
            className="block text-sm font-medium text-gray-300 mb-1 font-body"
          >
            Verification Code
          </label>
          <input
            id="otpCode"
            name="otpCode"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={otpCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              setOtpCode(value);
              if (error) setError(null);
            }}
            className="block w-full h-12 px-4 py-3 text-base font-body bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-500 transition-colors text-center tracking-widest rounded-xl"
            placeholder="000000"
            autoComplete="one-time-code"
          />
          {error && (
            <p
              className={` mt-1 text-sm font-body ${
                error.includes("sent") || error.includes("WhatsApp")
                  ? "text-green-400"
                  : resendCooldown > 0 && error.includes("wait")
                  ? "text-orange-600"
                  : "text-red-300"
              }`}
            >
              {resendCooldown > 0 && error.includes("wait")
                ? `Please wait ${resendCooldown} seconds before requesting a new code`
                : error}
            </p>
          )}
        </div>

        <div className="flex flex-col space-y-4">
          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className="w-full h-12 px-4 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-body rounded-xl shadow-lg"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Verifying...
              </>
            ) : (
              "Verify Code"
            )}
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-400 font-body">
              Didn't receive the code?{" "}
              {resendCooldown > 0 ? (
                <span className="inline-flex items-center text-gray-500 font-medium">
                  <svg
                    className="w-4 h-4 mr-1 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6l4 4"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      strokeWidth={2}
                      fill="none"
                    />
                  </svg>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resendLoading || !canResend}
                  className="font-medium text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading ? "Sending..." : "Resend Code"}
                </button>
              )}
            </p>
          </div>

          {onBack && (
            <div className="text-center">
              	<button
					type="button"
					onClick={onBack}
					className="text-sm text-white hover:text-gray-300 transition-colors font-body"
			  	>
			  		← Back
			  	</button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
