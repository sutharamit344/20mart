'use client';

import React, { useState } from 'react';
import { Button } from '@20mart/ui';
import { Megaphone, Plus, Sparkles, Flame, CheckCircle2 } from 'lucide-react';
import { useAdmin } from '../../lib/admin-store';

export default function PromotionsManagementPage() {
  const { showToast } = useAdmin();

  const [campaigns, setCampaigns] = useState([
    {
      id: 'cmp-1',
      title: 'Your Everyday Value Market – Launch Campaign',
      type: 'Hero Banner',
      headline: 'Useful products, Affordable prices, Everyday convenience.',
      status: 'ACTIVE',
      schedule: '01 Nov – 30 Nov 2026',
    },
    {
      id: 'cmp-2',
      title: 'Under ₹50 Everyday Essentials',
      type: 'Homepage Daily Deals Section',
      headline: 'Steal deals for kitchen and cleaning',
      status: 'ACTIVE',
      schedule: 'Daily Auto-Refresh',
    },
    {
      id: 'cmp-3',
      title: 'Early Access Survey Reward',
      type: 'Voucher Unlock Campaign',
      headline: 'Answer 3 questions to unlock ₹50 bonus',
      status: 'ACTIVE',
      schedule: 'All Active Users',
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Promotions & Campaigns</h1>
          <p className="text-xs text-gray-500 mt-1">
            Control homepage hero banners, featured offers, and marketing campaigns.
          </p>
        </div>
        <Button
          size="md"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => showToast('New promotional campaign created!')}
          className="rounded-xl font-bold"
        >
          Create Campaign
        </Button>
      </div>

      <div className="space-y-4">
        {campaigns.map((camp) => (
          <div
            key={camp.id}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#FF7A00] bg-orange-50 px-2 py-0.5 rounded">
                  {camp.type}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{camp.status}</span>
                </span>
              </div>
              <h3 className="text-sm font-bold text-gray-900">{camp.title}</h3>
              <p className="text-xs text-gray-500">{camp.headline}</p>
              <p className="text-[11px] text-gray-400">Schedule: {camp.schedule}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => showToast('Campaign updated!')}>
                Edit
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

