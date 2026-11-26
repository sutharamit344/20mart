'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { paiseToRupeeInput, parseRupeesToPaise } from '@20mart/shared';
import { api, ApiError, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { fromLocalInput, toLocalInput } from '../../../lib/datetime';
import { inputCls, labelCls, textareaCls } from '../../../components/ui';
import { ProductPicker, type PickedProduct } from '../../../components/ProductPicker';

export interface CouponFormValue {
  id?: string;
  code: string;
  title: string;
  description: string | null;
  discountType: 'FIXED' | 'PERCENT';
  discountValue: number;
  maxDiscountPaise: number | null;
  minOrderValuePaise: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  usageLimit: number | null;
  perCustomerLimit: number;
  requiresGrant: boolean;
  autoIssueOnSignup: boolean;
  products: PickedProduct[];
  categoryIds: string[];
}

export const EMPTY_COUPON: CouponFormValue = {
  code: '',
  title: '',
  description: null,
  discountType: 'FIXED',
  discountValue: 0,
  maxDiscountPaise: null,
  minOrderValuePaise: 0,
  startsAt: null,
  endsAt: null,
  isActive: false,
  usageLimit: null,
  perCustomerLimit: 1,
  requiresGrant: false,
  autoIssueOnSignup: false,
  products: [],
  categoryIds: [],
};

export function CouponForm({ initial, categories, canEdit, used }: { initial: CouponFormValue; categories: { id: string; name: string }[]; canEdit: boolean; used: boolean }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [v, setV] = useState(initial);
  const [value, setValue] = useState(initial.discountValue ? (initial.discountType === 'FIXED' ? paiseToRupeeInput(initial.discountValue) : String(initial.discountValue / 100)) : '');
  const [maxDisc, setMaxDisc] = useState(initial.maxDiscountPaise != null ? paiseToRupeeInput(initial.maxDiscountPaise) : '');
  const [minOrder, setMinOrder] = useState(initial.minOrderValuePaise ? paiseToRupeeInput(initial.minOrderValuePaise) : '');
  const [starts, setStarts] = useState(toLocalInput(initial.startsAt));
  const [ends, setEnds] = useState(toLocalInput(initial.endsAt));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof CouponFormValue>(k: K, val: CouponFormValue[K]) => setV((p) => ({ ...p, [k]: val }));
  const fe = (k: string) => errors[k]?.[0];

  const save = async () => {
    const local: Record<string, string[]> = {};
    const dv = v.discountType === 'FIXED' ? parseRupeesToPaise(value) : Math.round(Number(value) * 100);
    if (!dv || dv <= 0 || Number.isNaN(dv)) local.discountValue = ['Enter a discount greater than 0'];
    const md = maxDisc ? parseRupeesToPaise(maxDisc) : null;
    if (maxDisc && md == null) local.maxDiscountPaise = ['Enter an amount in rupees'];
    const mo = minOrder ? parseRupeesToPaise(minOrder) : 0;
    if (minOrder && mo == null) local.minOrderValuePaise = ['Enter an amount in rupees'];
    if (Object.keys(local).length) return setErrors(local);
    setSaving(true);
    setErrors({});
    const body = {
      code: v.code,
      title: v.title,
      description: v.description,
      discountType: v.discountType,
      discountValue: dv,
      maxDiscountPaise: v.discountType === 'PERCENT' ? md : null,
      minOrderValuePaise: mo ?? 0,
      startsAt: fromLocalInput(starts),
      endsAt: fromLocalInput(ends),
      isActive: v.isActive,
      usageLimit: v.usageLimit,
      perCustomerLimit: v.perCustomerLimit,
      requiresGrant: v.requiresGrant || v.autoIssueOnSignup,
      autoIssueOnSignup: v.autoIssueOnSignup,
      productIds: v.products.map((p) => p.id),
      categoryIds: v.categoryIds,
    };
    try {
      if (v.id) {
        await api(`/api/admin/coupons/${v.id}`, { method: 'PUT', body });
        showToast('Coupon saved');
        router.refresh();
      } else {
        const r = await api<{ id: string }>('/api/admin/coupons', { body });
        showToast('Coupon created');
        router.push(`/coupons/${r.id}`);
      }
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      showToast(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const dis = !canEdit;
  const lockValue = dis || used;
  return (
    <form
      className="space-y-4 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={dis} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="c-code">Code</label>
          <input id="c-code" className={`${inputCls} font-mono uppercase`} value={v.code} disabled={lockValue} maxLength={32} onChange={(e) => set('code', e.target.value.toUpperCase())} required />
          {fe('code') && <p className="mt-0.5 text-[10px] text-red-600">{fe('code')}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="c-title">Title (shown to customers)</label>
          <input id="c-title" className={inputCls} value={v.title} maxLength={120} onChange={(e) => set('title', e.target.value)} required />
          {fe('title') && <p className="mt-0.5 text-[10px] text-red-600">{fe('title')}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="c-desc">Description (optional)</label>
          <textarea id="c-desc" className={textareaCls} rows={2} maxLength={500} value={v.description ?? ''} onChange={(e) => set('description', e.target.value || null)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="c-type">Discount type</label>
          <select id="c-type" className={inputCls} value={v.discountType} disabled={lockValue} onChange={(e) => set('discountType', e.target.value as 'FIXED' | 'PERCENT')}>
            <option value="FIXED">Fixed amount (₹)</option>
            <option value="PERCENT">Percentage (%)</option>
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="c-value">{v.discountType === 'FIXED' ? 'Amount off (₹)' : 'Percent off (%)'}</label>
          <input id="c-value" className={inputCls} inputMode="decimal" value={value} disabled={lockValue} onChange={(e) => setValue(e.target.value)} placeholder={v.discountType === 'FIXED' ? '50' : '10'} />
          {fe('discountValue') && <p className="mt-0.5 text-[10px] text-red-600">{fe('discountValue')}</p>}
        </div>
        {v.discountType === 'PERCENT' && (
          <div>
            <label className={labelCls} htmlFor="c-max">Maximum discount (₹, optional)</label>
            <input id="c-max" className={inputCls} inputMode="decimal" value={maxDisc} disabled={lockValue} onChange={(e) => setMaxDisc(e.target.value)} />
            {fe('maxDiscountPaise') && <p className="mt-0.5 text-[10px] text-red-600">{fe('maxDiscountPaise')}</p>}
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor="c-min">Minimum order (₹)</label>
          <input id="c-min" className={inputCls} inputMode="decimal" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="0" />
          {fe('minOrderValuePaise') && <p className="mt-0.5 text-[10px] text-red-600">{fe('minOrderValuePaise')}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="c-start">Starts</label>
          <input id="c-start" type="datetime-local" className={inputCls} value={starts} onChange={(e) => setStarts(e.target.value)} />
          <p className="mt-0.5 text-[10px] text-gray-400">Empty = immediately</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="c-end">Ends</label>
          <input id="c-end" type="datetime-local" className={inputCls} value={ends} onChange={(e) => setEnds(e.target.value)} />
          {fe('endsAt') ? <p className="mt-0.5 text-[10px] text-red-600">{fe('endsAt')}</p> : <p className="mt-0.5 text-[10px] text-gray-400">Empty = no end date</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="c-total">Total uses (all customers)</label>
          <input id="c-total" type="number" min={1} className={inputCls} value={v.usageLimit ?? ''} onChange={(e) => set('usageLimit', e.target.value ? Math.max(1, Number(e.target.value)) : null)} placeholder="Unlimited" />
          {fe('usageLimit') && <p className="mt-0.5 text-[10px] text-red-600">{fe('usageLimit')}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="c-per">Uses per customer</label>
          <input id="c-per" type="number" min={1} max={100} className={inputCls} value={v.perCustomerLimit} onChange={(e) => set('perCustomerLimit', Math.max(1, Number(e.target.value) || 1))} />
        </div>
      </fieldset>

      <fieldset disabled={dis} className="space-y-2 rounded-lg border border-gray-100 p-3">
        <legend className="px-1 text-[11px] font-bold text-gray-700">Who can use it</legend>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-0.5" checked={v.requiresGrant || v.autoIssueOnSignup} disabled={v.autoIssueOnSignup} onChange={(e) => set('requiresGrant', e.target.checked)} />
          <span>
            <span className="font-semibold text-gray-800">Issued customers only</span>
            <span className="block text-[10px] text-gray-500">Only customers who were issued this coupon (sign-up, campaign or manual) can use it. Otherwise anyone with the code can.</span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-0.5" checked={v.autoIssueOnSignup} onChange={(e) => set('autoIssueOnSignup', e.target.checked)} />
          <span>
            <span className="font-semibold text-gray-800">Issue automatically to new customers</span>
            <span className="block text-[10px] text-gray-500">Welcome coupon: added to every new account at first sign-in while this coupon is active.</span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-0.5" checked={v.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          <span className="font-semibold text-gray-800">Active</span>
        </label>
      </fieldset>

      <fieldset disabled={dis} className="space-y-3 rounded-lg border border-gray-100 p-3">
        <legend className="px-1 text-[11px] font-bold text-gray-700">Eligible items (optional)</legend>
        <p className="text-[10px] text-gray-500">Leave both empty to apply to the whole cart. Otherwise the discount is calculated on matching items only.</p>
        <div>
          <span className={labelCls}>Categories</span>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const on = v.categoryIds.includes(c.id);
              return (
                <label key={c.id} className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${on ? 'border-brand-green bg-brand-green/5 text-brand-green' : 'border-gray-200 text-gray-600'}`}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={(e) => set('categoryIds', e.target.checked ? [...v.categoryIds, c.id] : v.categoryIds.filter((x) => x !== c.id))} />
                  {c.name}
                </label>
              );
            })}
          </div>
        </div>
        {canEdit ? <ProductPicker value={v.products} onChange={(p) => set('products', p)} /> : <p className="text-[11px] text-gray-600">{v.products.length} product(s)</p>}
      </fieldset>

      {used && canEdit && <p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-900">This coupon has been used, so its code and discount value are locked. Create a new coupon to change them.</p>}
      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="brand" isLoading={saving}>
            {v.id ? 'Save changes' : 'Create coupon'}
          </Button>
        </div>
      )}
    </form>
  );
}
