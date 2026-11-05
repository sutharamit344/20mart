'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo, Button } from '@20mart/ui';
import { useStore } from '../../../lib/store';
import { ShieldCheck, RotateCcw, ArrowRight } from 'lucide-react';

function OtpVerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') || '9876543210';
  const name = searchParams.get('name') || 'Customer';

  const { loginUser } = useStore();

  const [otp, setOtp] = useState<string[]>(['1', '2', '3', '4']);
  const [timer, setTimer] = useState<number>(30);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setTimeout(() => {
      loginUser(phone);
      setIsVerifying(false);
      router.push('/account');
    }, 600);
  };

  const handleResend = () => {
    setTimer(30);
    setOtp(['1', '2', '3', '4']);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 sm:py-16">
      <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-5 sm:p-7 shadow-xs space-y-5 text-center">
        {/* Brand Logo & Header */}
        <div className="space-y-1.5">
          <div className="flex justify-center mb-2">
            <Logo size="md" showTagline={false} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Verify Phone Number
          </h1>
          <p className="text-xs text-gray-500">
            We sent a 4-digit code to <span className="font-bold text-gray-900">+91 {phone}</span>
          </p>
        </div>

        {/* OTP Input Fields */}
        <form onSubmit={handleVerify} className="space-y-5">
          <div className="flex justify-center gap-3">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="w-12 h-12 sm:w-13 sm:h-13 rounded-xl border-2 border-gray-200 bg-gray-50 text-center text-lg font-bold text-gray-900 focus:bg-white focus:border-[#FF7A00] focus:outline-none transition-all"
              />
            ))}
          </div>

          <div className="text-xs text-gray-500">
            {timer > 0 ? (
              <p>Resend code in <span className="font-bold text-gray-800">{timer}s</span></p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="font-bold text-[#FF7A00] hover:underline"
              >
                Resend OTP
              </button>
            )}
          </div>

          <Button
            type="submit"
            size="md"
            variant="primary"
            isLoading={isVerifying}
            className="w-full font-bold shadow-xs py-2.5"
          >
            Verify & Proceed →
          </Button>
        </form>

        <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-gray-400 border-t border-gray-100">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Encrypted and Secure 20Mart Authentication</span>
        </div>
      </div>
    </div>
  );
}

export default function OtpPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading verification...</div>}>
      <OtpVerificationContent />
    </Suspense>
  );
}

