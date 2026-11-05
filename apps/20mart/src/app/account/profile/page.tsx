'use client';

import React, { useState } from 'react';
import { AccountLayout } from '../../../components/AccountLayout';
import { useStore } from '../../../lib/store';
import { Button, Input } from '@20mart/ui';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export default function EditProfilePage() {
  const { user, showToast } = useStore();

  const [name, setName] = useState(user?.name || 'Amit Kumar');
  const [phone, setPhone] = useState(user?.phone || '+91 98765 43210');
  const [email, setEmail] = useState(user?.email || 'amit@example.com');
  const [language, setLanguage] = useState('English');
  const [city, setCity] = useState('Ahmedabad');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast('Profile information saved successfully!');
    }, 500);
  };

  return (
    <AccountLayout
      title="Edit Profile"
      subtitle="Update your personal information and contact preferences."
      activeKey="profile"
    >
      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <Input
          label="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Mobile Number</label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={phone}
              disabled
              className="w-full h-9.5 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs sm:text-sm text-gray-700 font-semibold"
            />
            <span className="absolute right-3 flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Verified</span>
            </span>
          </div>
        </div>

        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Primary City</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-9.5 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-800 focus:outline-none focus:border-[#FF7A00]"
            >
              <option value="Ahmedabad">Ahmedabad</option>
              <option value="Gandhinagar">Gandhinagar</option>
              <option value="Vadodara">Vadodara</option>
              <option value="Surat">Surat</option>
              <option value="Rajkot">Rajkot</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Preferred Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full h-9.5 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-800 focus:outline-none focus:border-[#FF7A00]"
            >
              <option value="English">English</option>
              <option value="Gujarati">ગુજરાતી (Gujarati)</option>
              <option value="Hindi">हिन्दी (Hindi)</option>
            </select>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            type="submit"
            size="md"
            variant="primary"
            isLoading={isSaving}
            className="font-bold px-6 shadow-xs"
          >
            Save Profile Changes
          </Button>
        </div>
      </form>
    </AccountLayout>
  );
}

