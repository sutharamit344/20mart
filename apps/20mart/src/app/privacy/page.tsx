'use client';

import React from 'react';
import Link from 'next/link';
import { Breadcrumb } from '@20mart/ui';
import { Shield, Lock, Eye, FileText } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Privacy Policy' },
        ]}
      />

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#0B5D3B] text-xs font-bold border border-emerald-200/50">
          <Shield className="w-3.5 h-3.5" />
          <span>Security & Data Protection</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">20Mart Privacy Policy</h1>
        <p className="text-xs text-gray-400">Effective Date: November 2026 • 20Mart Retail India</p>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs text-xs sm:text-sm text-gray-600 space-y-6 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#0B5D3B]" />
            <span>1. Information We Collect</span>
          </h2>
          <p>
            When you register on 20Mart, place an order, or participate in the Early Access survey, we collect information including your name, delivery address, phone number for OTP verification, email address, and order transaction history.
          </p>
          <p>
            We do not store your credit card, debit card, or UPI PIN on our servers. All online payments are securely processed by RBI-licensed payment gateways with end-to-end encryption.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#0B5D3B]" />
            <span>2. How We Use Your Data</span>
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To dispatch, track, and deliver your grocery and home essentials packages.</li>
            <li>To verify mobile numbers using one-time passwords (OTP) for secure account logins.</li>
            <li>To unlock earned survey vouchers (e.g., SURVEY50) and notify you of dispatch timelines.</li>
            <li>To provide continuous customer support regarding replacements or delivery queries.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0B5D3B]" />
            <span>3. Data Protection & Sharing</span>
          </h2>
          <p>
            20Mart strictly does not sell, rent, or trade your personal data with third-party advertisers. We only share necessary delivery details (such as address and phone number) with our verified delivery partners to fulfill your doorstep orders.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">4. Contact Our Data Protection Team</h2>
          <p>
            For inquiries regarding privacy, data deletion, or updating your information, email us at{' '}
            <a href="mailto:privacy@20mart.in" className="text-[#FF7A00] font-bold underline">
              privacy@20mart.in
            </a>{' '}
            or visit our <Link href="/contact" className="text-[#0B5D3B] font-bold underline">Contact Page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}

