'use client';

import React, { useState } from 'react';
import { useAdmin } from '../../lib/admin-store';
import { BusinessConfigurations } from '@20mart/shared';
import { Button, Switch, ConfirmDialog } from '@20mart/ui';
import {
  Sliders,
  ShoppingBag,
  Package,
  Tag,
  HelpCircle,
  Gift,
  Truck,
  CreditCard,
  Bell,
  Sparkles,
  Shield,
  Save,
  RotateCcw,
  History,
  CheckCircle2,
} from 'lucide-react';

type SectionKey = keyof BusinessConfigurations;

export default function ConfigurationsPage() {
  const { configs, updateConfigs, configHistory, showToast } = useAdmin();

  const [activeTab, setActiveTab] = useState<SectionKey | 'history'>('general');
  const [formState, setFormState] = useState<BusinessConfigurations>(configs);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const sections: { key: SectionKey; label: string; icon: any; desc: string }[] = [
    { key: 'general', label: '1. General Settings', icon: Sliders, desc: 'Store profile, city, tagline & maintenance' },
    { key: 'shopping', label: '2. Shopping Settings', icon: ShoppingBag, desc: 'Cart minimums, free shipping thresholds' },
    { key: 'product', label: '3. Product Settings', icon: Package, desc: 'Low stock thresholds, reviews & variants' },
    { key: 'coupon', label: '4. Coupon Settings', icon: Tag, desc: 'Discount caps, stacking & validity days' },
    { key: 'question', label: '5. Question Settings', icon: HelpCircle, desc: 'Survey question counts & targeting' },
    { key: 'reward', label: '6. Reward Settings', icon: Gift, desc: 'Launch coupons, survey vouchers' },
    { key: 'delivery', label: '7. Delivery Settings', icon: Truck, desc: 'Charges, store pickup & turnaround' },
    { key: 'payment', label: '8. Payment Settings', icon: CreditCard, desc: 'UPI, Card & Cash on Delivery rules' },
    { key: 'notification', label: '9. Notification Settings', icon: Bell, desc: 'SMS updates, email receipts' },
    { key: 'features', label: '10. Feature Flags', icon: Sparkles, desc: 'Toggle storefront modules dynamically' },
    { key: 'platform', label: '11. Platform Settings', icon: Shield, desc: 'API rate limits, audit retention & sessions' },
  ];

  const handleFieldChange = (section: SectionKey, field: string, value: any) => {
    setFormState((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleSaveAll = () => {
    Object.keys(formState).forEach((key) => {
      const sec = key as SectionKey;
      updateConfigs(sec, formState[sec]);
    });
    setHasUnsavedChanges(false);
    showToast('All 11 configuration sections saved and synced!');
  };

  const handleDiscardChanges = () => {
    setFormState(configs);
    setHasUnsavedChanges(false);
    showToast('Changes discarded.');
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Business Configurations</h1>
          <p className="text-xs text-gray-500 mt-1">
            Dynamic business rules engine. Changes take effect across storefront applications immediately without code redeployments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
              activeTab === 'history'
                ? 'border-[#0B5D3B] bg-emerald-50 text-[#0B5D3B]'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History ({configHistory.length})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Navigation: 11 Section Tabs */}
        <div className="lg:col-span-4 rounded-3xl border border-gray-100 bg-white p-3 shadow-xs space-y-1">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeTab === sec.key;
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setActiveTab(sec.key)}
                className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-all ${
                  isActive
                    ? 'bg-[#0B5D3B] text-white shadow-xs'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold truncate leading-snug">{sec.label}</h4>
                  <p
                    className={`text-[10px] mt-0.5 line-clamp-1 ${
                      isActive ? 'text-emerald-100' : 'text-gray-400'
                    }`}
                  >
                    {sec.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Content Area: Forms */}
        <div className="lg:col-span-8 rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs">
          {activeTab === 'history' ? (
            <div className="space-y-4">
              <h3 className="text-base font-black text-gray-900 pb-2 border-b border-gray-100">
                Configuration Change History
              </h3>
              <div className="divide-y divide-gray-100">
                {configHistory.map((item, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 uppercase">{item.section}</span>
                      <span className="text-[11px] text-gray-400">{item.timestamp}</span>
                    </div>
                    <p className="text-gray-600">{item.changeNote}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Changed by: {item.admin}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Section Header */}
              <div className="pb-4 border-b border-gray-100">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#FF7A00]">
                  Section Config
                </span>
                <h2 className="text-xl font-black text-gray-900 mt-0.5">
                  {sections.find((s) => s.key === activeTab)?.label}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {sections.find((s) => s.key === activeTab)?.desc}
                </p>
              </div>

              {/* SECTION 1: GENERAL */}
              {activeTab === 'general' && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Store Name</label>
                    <input
                      type="text"
                      value={formState.general.storeName}
                      onChange={(e) => handleFieldChange('general', 'storeName', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Brand Tagline</label>
                    <input
                      type="text"
                      value={formState.general.tagline}
                      onChange={(e) => handleFieldChange('general', 'tagline', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 p-2.5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Support Email</label>
                      <input
                        type="email"
                        value={formState.general.supportEmail}
                        onChange={(e) => handleFieldChange('general', 'supportEmail', e.target.value)}
                        className="w-full rounded-xl border border-gray-200 p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Support Phone</label>
                      <input
                        type="text"
                        value={formState.general.supportPhone}
                        onChange={(e) => handleFieldChange('general', 'supportPhone', e.target.value)}
                        className="w-full rounded-xl border border-gray-200 p-2.5"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Primary Operating City</label>
                    <input
                      type="text"
                      value={formState.general.operatingCity}
                      onChange={(e) => handleFieldChange('general', 'operatingCity', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 p-2.5"
                    />
                  </div>
                  <div className="pt-2">
                    <Switch
                      label="Storefront Maintenance Mode"
                      checked={formState.general.maintenanceMode}
                      onChange={(v) => handleFieldChange('general', 'maintenanceMode', v)}
                    />
                  </div>
                </div>
              )}

              {/* SECTION 2: SHOPPING */}
              {activeTab === 'shopping' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Minimum Cart Value (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formState.shopping.minCartValue}
                        onChange={(e) => handleFieldChange('shopping', 'minCartValue', Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-200 p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Free Delivery Threshold (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formState.shopping.freeDeliveryThreshold}
                        onChange={(e) => handleFieldChange('shopping', 'freeDeliveryThreshold', Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-200 p-2.5"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Max Allowed Quantity per Product in Cart
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formState.shopping.maxQuantityPerProduct}
                      onChange={(e) => handleFieldChange('shopping', 'maxQuantityPerProduct', Number(e.target.value))}
                      className="w-full rounded-xl border border-gray-200 p-2.5"
                    />
                  </div>
                  <div className="space-y-3 pt-2">
                    <Switch
                      label="Allow Guest Browsing"
                      checked={formState.shopping.allowGuestBrowsing}
                      onChange={(v) => handleFieldChange('shopping', 'allowGuestBrowsing', v)}
                    />
                    <Switch
                      label="Require OTP Phone Verification at Checkout"
                      checked={formState.shopping.requirePhoneVerificationOnCheckout}
                      onChange={(v) => handleFieldChange('shopping', 'requirePhoneVerificationOnCheckout', v)}
                    />
                  </div>
                </div>
              )}

              {/* SECTION 3: PRODUCT */}
              {activeTab === 'product' && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Low-Stock Warning Alert Threshold (Units)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formState.product.lowStockThreshold}
                      onChange={(e) => handleFieldChange('product', 'lowStockThreshold', Number(e.target.value))}
                      className="w-full rounded-xl border border-gray-200 p-2.5"
                    />
                  </div>
                  <div className="space-y-3 pt-2">
                    <Switch
                      label="Show Out-of-Stock Badge on Cards"
                      checked={formState.product.showOutOfStockBadge}
                      onChange={(v) => handleFieldChange('product', 'showOutOfStockBadge', v)}
                    />
                    <Switch
                      label="Enable Customer Star Ratings & Reviews"
                      checked={formState.product.enableCustomerReviews}
                      onChange={(v) => handleFieldChange('product', 'enableCustomerReviews', v)}
                    />
                    <Switch
                      label="Require Verified Purchase to Submit Review"
                      checked={formState.product.requirePurchaseForReview}
                      onChange={(v) => handleFieldChange('product', 'requirePurchaseForReview', v)}
                    />
                  </div>
                </div>
              )}

              {/* SECTION 4: COUPON */}
              {activeTab === 'coupon' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Max Coupon Discount per Order (₹)
                      </label>
                      <input
                        type="number"
                        value={formState.coupon.maxDiscountPerOrder}
                        onChange={(e) => handleFieldChange('coupon', 'maxDiscountPerOrder', Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-200 p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Default Coupon Validity (Days)
                      </label>
                      <input
                        type="number"
                        value={formState.coupon.defaultValidityDays}
                        onChange={(e) => handleFieldChange('coupon', 'defaultValidityDays', Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-200 p-2.5"
                      />
                    </div>
                  </div>
                  <div className="space-y-3 pt-2">
                    <Switch
                      label="Allow Multiple Coupons Stacking in Same Order"
                      checked={formState.coupon.allowCouponStacking}
                      onChange={(v) => handleFieldChange('coupon', 'allowCouponStacking', v)}
                    />
                    <Switch
                      label="Auto-apply WELCOME50 on First Order"
                      checked={formState.coupon.autoApplyWelcomeCoupon}
                      onChange={(v) => handleFieldChange('coupon', 'autoApplyWelcomeCoupon', v)}
                    />
                  </div>
                </div>
              )}

              {/* SECTION 5: QUESTION */}
              {activeTab === 'question' && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Survey Questions Presented per Session
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={formState.question.surveyQuestionsCount}
                      onChange={(e) => handleFieldChange('question', 'surveyQuestionsCount', Number(e.target.value))}
                      className="w-full rounded-xl border border-gray-200 p-2.5"
                    />
                  </div>
                  <div className="space-y-3 pt-2">
                    <Switch
                      label="Complete Survey Required to Unlock ₹50 Bonus"
                      checked={formState.question.surveyRequiredForReward}
                      onChange={(v) => handleFieldChange('question', 'surveyRequiredForReward', v)}
                    />
                    <Switch
                      label="Auto-suggest Questions Based on Cart Items"
                      checked={formState.question.autoSuggestCategories}
                      onChange={(v) => handleFieldChange('question', 'autoSuggestCategories', v)}
                    />
                  </div>
                </div>
              )}

              {/* SECTION 6: REWARD */}
              {activeTab === 'reward' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Launch Welcome Coupon Value (₹)
                      </label>
                      <input
                        type="number"
                        value={formState.reward.launchCouponValue}
                        onChange={(e) => handleFieldChange('reward', 'launchCouponValue', Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-200 p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Survey Completion Reward Value (₹)
                      </label>
                      <input
                        type="number"
                        value={formState.reward.surveyRewardValue}
                        onChange={(e) => handleFieldChange('reward', 'surveyRewardValue', Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-200 p-2.5"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Minimum Cart Order to Redeem Reward (₹)
                    </label>
                    <input
                      type="number"
                      value={formState.reward.minOrderForRewardRedemption}
                      onChange={(e) => handleFieldChange('reward', 'minOrderForRewardRedemption', Number(e.target.value))}
                      className="w-full rounded-xl border border-gray-200 p-2.5"
                    />
                  </div>
                </div>
              )}

              {/* SECTION 7: DELIVERY */}
              {activeTab === 'delivery' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Standard Doorstep Delivery Charge (₹)
                      </label>
                      <input
                        type="number"
                        value={formState.delivery.standardDeliveryCharge}
                        onChange={(e) => handleFieldChange('delivery', 'standardDeliveryCharge', Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-200 p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Estimated Delivery Turnaround
                      </label>
                      <input
                        type="text"
                        value={formState.delivery.estimatedDeliveryDays}
                        onChange={(e) => handleFieldChange('delivery', 'estimatedDeliveryDays', e.target.value)}
                        className="w-full rounded-xl border border-gray-200 p-2.5"
                      />
                    </div>
                  </div>
                  <div className="pt-2">
                    <Switch
                      label="Enable Storefront Store Pickup (Free)"
                      checked={formState.delivery.storePickupAvailable}
                      onChange={(v) => handleFieldChange('delivery', 'storePickupAvailable', v)}
                    />
                  </div>
                </div>
              )}

              {/* SECTION 8: PAYMENT */}
              {activeTab === 'payment' && (
                <div className="space-y-4 text-xs">
                  <div className="space-y-3">
                    <Switch
                      label="Enable Instant Online UPI (GPay, PhonePe, Paytm)"
                      checked={formState.payment.enableUPI}
                      onChange={(v) => handleFieldChange('payment', 'enableUPI', v)}
                    />
                    <Switch
                      label="Enable Credit & Debit Cards"
                      checked={formState.payment.enableCards}
                      onChange={(v) => handleFieldChange('payment', 'enableCards', v)}
                    />
                    <Switch
                      label="Enable Cash on Delivery (COD)"
                      checked={formState.payment.enableCashOnDelivery}
                      onChange={(v) => handleFieldChange('payment', 'enableCashOnDelivery', v)}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Max Order Limit for Cash on Delivery (₹)
                    </label>
                    <input
                      type="number"
                      value={formState.payment.codMaxLimit}
                      onChange={(e) => handleFieldChange('payment', 'codMaxLimit', Number(e.target.value))}
                      className="w-full rounded-xl border border-gray-200 p-2.5"
                    />
                  </div>
                </div>
              )}

              {/* SECTION 9: NOTIFICATION */}
              {activeTab === 'notification' && (
                <div className="space-y-4 text-xs">
                  <div className="space-y-3">
                    <Switch
                      label="Send SMS Order Dispatched & Out for Delivery Updates"
                      checked={formState.notification.enableSmsOrderUpdates}
                      onChange={(v) => handleFieldChange('notification', 'enableSmsOrderUpdates', v)}
                    />
                    <Switch
                      label="Send Email Order Invoices & Receipts"
                      checked={formState.notification.enableEmailReceipts}
                      onChange={(v) => handleFieldChange('notification', 'enableEmailReceipts', v)}
                    />
                    <Switch
                      label="Send Promotional Offers & Coupon Notifications"
                      checked={formState.notification.enablePromoNotifications}
                      onChange={(v) => handleFieldChange('notification', 'enablePromoNotifications', v)}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">SMS Sender Header ID</label>
                    <input
                      type="text"
                      value={formState.notification.smsSenderId}
                      onChange={(e) => handleFieldChange('notification', 'smsSenderId', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 p-2.5 uppercase font-mono font-bold"
                    />
                  </div>
                </div>
              )}

              {/* SECTION 10: FEATURES */}
              {activeTab === 'features' && (
                <div className="space-y-4 text-xs">
                  <p className="text-gray-500 text-xs">
                    Toggle visibility of storefront widgets and promotional features in real time:
                  </p>
                  <div className="space-y-3 pt-1">
                    <Switch
                      label="Show Early Access Member Banner on Homepage"
                      checked={formState.features.enableEarlyAccessBanner}
                      onChange={(v) => handleFieldChange('features', 'enableEarlyAccessBanner', v)}
                    />
                    <Switch
                      label="Show 'Under ₹50 Daily Deals' Section on Homepage"
                      checked={formState.features.enableDailyDealsSection}
                      onChange={(v) => handleFieldChange('features', 'enableDailyDealsSection', v)}
                    />
                    <Switch
                      label="Show 'Trending Products' Carousel"
                      checked={formState.features.enableTrendingSection}
                      onChange={(v) => handleFieldChange('features', 'enableTrendingSection', v)}
                    />
                    <Switch
                      label="Show Survey Reward Prompt on Navbar"
                      checked={formState.features.enableProductSurveyReward}
                      onChange={(v) => handleFieldChange('features', 'enableProductSurveyReward', v)}
                    />
                    <Switch
                      label="Enable Customer Wishlist Feature"
                      checked={formState.features.enableWishlist}
                      onChange={(v) => handleFieldChange('features', 'enableWishlist', v)}
                    />
                  </div>
                </div>
              )}

              {/* SECTION 11: PLATFORM */}
              {activeTab === 'platform' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        API Rate Limit (Req / Minute)
                      </label>
                      <input
                        type="number"
                        value={formState.platform.apiRateLimitPerMinute}
                        onChange={(e) => handleFieldChange('platform', 'apiRateLimitPerMinute', Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-200 p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Session Inactivity Timeout (Minutes)
                      </label>
                      <input
                        type="number"
                        value={formState.platform.sessionTimeoutMinutes}
                        onChange={(e) => handleFieldChange('platform', 'sessionTimeoutMinutes', Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-200 p-2.5"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Audit Trail Retention Period (Days)
                    </label>
                    <input
                      type="number"
                      value={formState.platform.auditLogRetentionDays}
                      onChange={(e) => handleFieldChange('platform', 'auditLogRetentionDays', Number(e.target.value))}
                      className="w-full rounded-xl border border-gray-200 p-2.5"
                    />
                  </div>
                  <div className="pt-2">
                    <Switch
                      label="Enforce Multi-factor & Strong Admin Passwords"
                      checked={formState.platform.enforceStrongPasswords}
                      onChange={(v) => handleFieldChange('platform', 'enforceStrongPasswords', v)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Unsaved Changes Bar */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center px-4 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-4 p-3.5 sm:px-6 rounded-2xl bg-gray-900 text-white shadow-2xl border border-gray-700">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF7A00] animate-ping" />
              <span>You have unsaved configuration changes!</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                Discard
              </button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleSaveAll}
                leftIcon={<Save className="w-3.5 h-3.5" />}
                className="rounded-xl font-bold"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

