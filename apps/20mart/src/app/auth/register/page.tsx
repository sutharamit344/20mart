'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo, Button, Input } from '@20mart/ui';
import { useStore } from '../../../lib/store';
import { Sparkles, Truck, ShieldCheck, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { loginUser } = useStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pincode, setPincode] = useState('380061');
  const [referralCode, setReferralCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) return;
    setIsSubmitting(true);
    setTimeout(() => {
      loginUser(phone);
      setIsSubmitting(false);
      router.push(`/auth/otp?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name || 'Customer')}`);
    }, 500);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 sm:py-12">
      <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-5 sm:p-7 shadow-xs space-y-5">
        {/* Brand Logo & Header */}
        <div className="text-center space-y-1.5">
          <div className="flex justify-center mb-2">
            <Logo size="md" showTagline={false} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Create Your Account
          </h1>
          <p className="text-xs text-gray-500">
            Join 20Mart for everyday essentials at unbeatable value
          </p>
        </div>

        {/* Bonus Voucher Callout */}
        <div className="rounded-xl bg-[#FFF6E9] border border-orange-200/80 p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#FF7A00] shadow-xs">
            <Sparkles className="w-5 h-5 fill-current" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">Get ₹50 Welcome Voucher</p>
            <p className="text-[11px] text-gray-600">Applied automatically on your first order above ₹99</p>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Full Name"
            placeholder="e.g. Amit Kumar"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Mobile Number</label>
            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center gap-1 text-xs font-bold text-gray-600 border-r border-gray-200 pr-2 pointer-events-none">
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
                className="w-full h-9.5 rounded-xl border border-gray-200 bg-white pl-16 pr-3 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#FF7A00]"
              />
            </div>
          </div>

          <Input
            label="Email Address (Optional)"
            type="email"
            placeholder="amit@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="City"
              value="Ahmedabad"
              disabled
              className="bg-gray-50 text-gray-600"
            />
            <Input
              label="Delivery Pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              required
            />
          </div>

          <Input
            label="Referral / Invite Code (Optional)"
            placeholder="e.g. EARLY20"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          />

          <Button
            type="submit"
            size="md"
            variant="primary"
            isLoading={isSubmitting}
            className="w-full font-bold shadow-xs mt-2"
          >
            Create Account & Send OTP
          </Button>
        </form>

        {/* Footer info */}
        <div className="pt-2 border-t border-gray-100 text-center text-xs text-gray-500">
          Already have an account?{' '}
          <Link href="/auth" className="font-bold text-[#FF7A00] hover:underline">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}

