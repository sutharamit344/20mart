'use client';

import React, { useEffect, useState } from 'react';
import { AccountLayout } from '../../../components/AccountLayout';
import { storeApi, StoreApiError, useStore } from '../../../lib/store';
import { Button, Input } from '@20mart/ui';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export default function EditProfilePage() {
  const { user, showToast, refreshUser } = useStore();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [email, setEmail] = useState(user?.email ?? '');

  // The session user loads asynchronously; sync the form once it arrives.
  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setEmail(user.email ?? '');
    }
  }, [user]);
  useEffect(() => {
    storeApi<{ name: string | null; profile: { phone: string | null } | null }>('/api/account/profile')
      .then((p) => {
        setName(p.name ?? '');
        setPhone(p.profile?.phone ?? '');
      })
      .catch(() => undefined);
  }, []);
  const [language, setLanguage] = useState('English');
  const [city, setCity] = useState('Ahmedabad');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrors({});
    try {
      await storeApi('/api/account/profile', { method: 'PATCH', body: { name, phone } });
      await refreshUser();
      showToast('Profile saved');
    } catch (err) {
      if (err instanceof StoreApiError) setErrors(err.fieldErrors);
      showToast(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setIsSaving(false);
    }
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
            <span className="absolute left-3 text-xs sm:text-sm font-semibold text-gray-500">+91</span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="10-digit mobile number"
              className="w-full h-9.5 rounded-xl border border-gray-200 bg-white pl-11 pr-3 text-xs sm:text-sm text-gray-900 font-semibold focus:border-brand-orange focus:outline-none"
            />
          </div>
          {errors.phone?.[0] && <p className="mt-1 text-[11px] font-medium text-red-600">{errors.phone[0]}</p>}
        </div>

        <div>
          <Input label="Email Address" type="email" value={email} readOnly disabled />
          <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
            <CheckCircle2 className="w-3 h-3" /> Verified by Google — managed in your Google account
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Primary City</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-9.5 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-800 focus:outline-none focus:border-brand-orange"
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
              className="w-full h-9.5 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-800 focus:outline-none focus:border-brand-orange"
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

