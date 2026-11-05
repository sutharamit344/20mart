'use client';

import React, { useState } from 'react';
import { Button } from '@20mart/ui';
import { AccountLayout } from '../../../components/AccountLayout';
import { useStore } from '../../../lib/store';
import {
  Bell,
  Lock,
  Globe,
  Shield,
  Smartphone,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

export default function AccountSettingsPage() {
  const { showToast } = useStore();
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [promoEmails, setPromoEmails] = useState(false);
  const [language, setLanguage] = useState('English');

  const handleSave = () => {
    showToast('Settings saved successfully!');
  };

  return (
    <AccountLayout
      title="Account Settings"
      subtitle="Manage your notifications, privacy, communication channels and security"
      activeKey="settings"
    >
      <div className="space-y-5">
        {/* Notifications & Communication */}
        <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <Bell className="w-4 h-4 text-[#FF7A00]" />
            <h3 className="text-sm font-bold text-gray-900">Communication & Alerts</h3>
          </div>

          <div className="space-y-3.5 divide-y divide-gray-50">
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-bold text-gray-800">Order Status SMS & Push</p>
                <p className="text-[11px] text-gray-500">Get instant updates on dispatch & delivery</p>
              </div>
              <input
                type="checkbox"
                checked={orderUpdates}
                onChange={(e) => setOrderUpdates(e.target.checked)}
                className="w-4 h-4 rounded-sm text-[#0B5D3B] focus:ring-[#0B5D3B] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-bold text-gray-800">WhatsApp Delivery Updates</p>
                <p className="text-[11px] text-gray-500">Receive delivery tracking link & receipt via WhatsApp</p>
              </div>
              <input
                type="checkbox"
                checked={whatsappAlerts}
                onChange={(e) => setWhatsappAlerts(e.target.checked)}
                className="w-4 h-4 rounded-sm text-[#0B5D3B] focus:ring-[#0B5D3B] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-bold text-gray-800">Promotions & Exclusive Deals</p>
                <p className="text-[11px] text-gray-500">Get notified about weekend sales and discount coupons</p>
              </div>
              <input
                type="checkbox"
                checked={promoEmails}
                onChange={(e) => setPromoEmails(e.target.checked)}
                className="w-4 h-4 rounded-sm text-[#0B5D3B] focus:ring-[#0B5D3B] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Regional & Language Preferences */}
        <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <Globe className="w-4 h-4 text-[#0B5D3B]" />
            <h3 className="text-sm font-bold text-gray-900">Language & Region</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Preferred Display Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium focus:border-[#0B5D3B] focus:outline-hidden"
              >
                <option value="English">English (India)</option>
                <option value="Hindi">हिंदी (Hindi)</option>
                <option value="Gujarati">ગુજરાતી (Gujarati)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Default Currency</label>
              <input
                type="text"
                disabled
                value="₹ INR (Indian Rupee)"
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Security & Devices */}
        <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <Lock className="w-4 h-4 text-[#0B5D3B]" />
            <h3 className="text-sm font-bold text-gray-900">Security</h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-gray-800">Two-Factor Authentication (OTP)</p>
              <p className="text-[11px] text-gray-500">Every login verifies your registered mobile phone</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0B5D3B] bg-emerald-50 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} size="sm">
            Save Preferences
          </Button>
        </div>
      </div>
    </AccountLayout>
  );
}

