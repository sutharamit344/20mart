'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Button, Modal } from '@20mart/ui';
import { useStore } from '../../lib/store';
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  Phone,
  ArrowRight,
  Mail,
} from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const { loginUser } = useStore();

  const [phone, setPhone] = useState('9876543210');
  const [isRegister, setIsRegister] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState(['1', '2', '3', '4']);
  const [isSending, setIsSending] = useState(false);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) return;
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setOtpModalOpen(true);
    }, 600);
  };

  const handleVerifyOtp = () => {
    loginUser(phone);
    setOtpModalOpen(false);
    router.push('/account');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-md space-y-6">
        {/* Brand Logo & Header (Screen 13 & Mobile Screen 13) */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <Logo size="lg" showTagline={true} />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">
            {isRegister ? 'Create an Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-gray-500">
            {isRegister
              ? 'Join 20Mart to unlock exclusive welcome coupons & fast delivery'
              : 'Enter your 10-digit mobile number to login'}
          </p>
        </div>

        {/* Benefits reminder */}
        <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-orange-50/60 border border-orange-100 text-[11px] text-gray-700">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span>₹50 First Order Coupon</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-[#0B5D3B]" />
            <span>Free Delivery &gt; ₹199</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Mobile Number
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center gap-1 text-xs font-bold text-gray-600 border-r border-gray-200 pr-2">
                <span>🇮🇳</span>
                <span>+91</span>
              </div>
              <input
                type="tel"
                required
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 10-digit mobile"
                className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-2.5 pl-20 pr-4 text-sm font-semibold text-gray-900 focus:bg-white focus:border-[#FF7A00] focus:outline-none"
              />
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            variant="primary"
            isLoading={isSending}
            className="w-full rounded-xl font-bold py-3 shadow-md"
          >
            Send OTP
          </Button>
        </form>

        {/* Social / Alternative Divider */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100" />
          </div>
          <span className="relative bg-white px-3 text-[11px] uppercase font-bold text-gray-400">
            or continue with
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSendOtp({ preventDefault: () => {} } as any)}
            className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>Google</span>
          </button>
          <button
            type="button"
            onClick={() => handleSendOtp({ preventDefault: () => {} } as any)}
            className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-gray-500" />
            <span>Email</span>
          </button>
        </div>

        {/* Toggle Login / Register */}
        <div className="text-center text-xs text-gray-500">
          {isRegister ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setIsRegister(false)}
                className="font-bold text-[#FF7A00] hover:underline"
              >
                Login
              </button>
            </p>
          ) : (
            <p>
              New to 20Mart?{' '}
              <button
                type="button"
                onClick={() => setIsRegister(true)}
                className="font-bold text-[#FF7A00] hover:underline"
              >
                Create an Account
              </button>
            </p>
          )}
        </div>
      </div>

      {/* OTP Verification Modal */}
      <Modal
        isOpen={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        title="Verify One-Time Password"
      >
        <div className="text-center space-y-4">
          <p className="text-xs text-gray-600">
            We sent a 4-digit verification code to <br />
            <span className="font-bold text-gray-900">+91 {phone}</span>
          </p>

          <div className="flex justify-center gap-3 py-2">
            {[0, 1, 2, 3].map((idx) => (
              <input
                key={idx}
                type="text"
                maxLength={1}
                value={otpCode[idx] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const newCode = [...otpCode];
                  newCode[idx] = val;
                  setOtpCode(newCode);
                }}
                className="h-12 w-12 text-center text-lg font-black rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:bg-white focus:border-[#FF7A00] focus:outline-none"
              />
            ))}
          </div>

          <p className="text-[11px] text-gray-400">
            Auto-filled mock OTP for instant demo:{' '}
            <span className="font-bold text-[#0B5D3B]">1234</span>
          </p>

          <div className="pt-2">
            <Button
              size="lg"
              variant="primary"
              onClick={handleVerifyOtp}
              className="w-full rounded-xl font-bold"
            >
              Verify & Continue
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

