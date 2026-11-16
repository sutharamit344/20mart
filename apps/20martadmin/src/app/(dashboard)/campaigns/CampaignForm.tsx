'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { api, ApiError, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { fromLocalInput, toLocalInput } from '../../../lib/datetime';
import { inputCls, labelCls, textareaCls } from '../../../components/ui';
import { ProductPicker, type PickedProduct } from '../../../components/ProductPicker';
import { ImageUploadField } from '../../../components/ImageUploadField';

export interface CampaignFormValue {
  id?: string;
  name: string;
  slug: string;
  type: 'PROMOTION' | 'FILL_YOUR_CART';
  description: string | null;
  bannerTitle: string | null;
  bannerSubtitle: string | null;
  bannerImageUrl: string | null;
  isActive: boolean;
  showOnHomepage: boolean;
  startsAt: string | null;
  endsAt: string | null;
  couponId: string | null;
  maxQtyPerItem: number;
  displayOrder: number;
  products: PickedProduct[];
}

export const EMPTY_CAMPAIGN: CampaignFormValue = {
  name: '',
  slug: '',
  type: 'PROMOTION',
  description: null,
  bannerTitle: null,
  bannerSubtitle: null,
  bannerImageUrl: null,
  isActive: false,
  showOnHomepage: true,
  startsAt: null,
  endsAt: null,
  couponId: null,
  maxQtyPerItem: 10,
  displayOrder: 0,
  products: [],
};

export function CampaignForm({ initial, coupons, canEdit, canUpload, hasParticipants }: { initial: CampaignFormValue; coupons: { id: string; code: string; title: string; isActive: boolean }[]; canEdit: boolean; canUpload: boolean; hasParticipants: boolean }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [v, setV] = useState(initial);
  const [starts, setStarts] = useState(toLocalInput(initial.startsAt));
  const [ends, setEnds] = useState(toLocalInput(initial.endsAt));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof CampaignFormValue>(k: K, val: CampaignFormValue[K]) => setV((p) => ({ ...p, [k]: val }));
  const fe = (k: string) => errors[k]?.[0];
  const opt = (s: string | null) => (s && s.trim() ? s : null);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const body = {
      name: v.name,
      slug: v.slug || undefined,
      type: v.type,
      description: opt(v.description),
      bannerTitle: opt(v.bannerTitle),
      bannerSubtitle: opt(v.bannerSubtitle),
      bannerImageUrl: v.bannerImageUrl,
      isActive: v.isActive,
      showOnHomepage: v.showOnHomepage,
      startsAt: fromLocalInput(starts),
      endsAt: fromLocalInput(ends),
      couponId: v.couponId,
      maxQtyPerItem: v.maxQtyPerItem,
      displayOrder: v.displayOrder,
      productIds: v.products.map((p) => p.id),
    };
    try {
      if (v.id) {
        const r = await api<{ slug: string }>(`/api/admin/campaigns/${v.id}`, { method: 'PUT', body });
        set('slug', r.slug);
        showToast('Campaign saved');
        router.refresh();
      } else {
        const r = await api<{ id: string }>('/api/admin/campaigns', { body });
        showToast('Campaign created');
        router.push(`/campaigns/${r.id}`);
      }
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      showToast(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const fyc = v.type === 'FILL_YOUR_CART';
  return (
    <form
      className="space-y-4 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={!canEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="cp-name">Name</label>
          <input id="cp-name" className={inputCls} value={v.name} maxLength={120} required onChange={(e) => set('name', e.target.value)} />
          {fe('name') && <p className="mt-0.5 text-[10px] text-red-600">{fe('name')}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="cp-type">Type</label>
          <select id="cp-type" className={inputCls} value={v.type} disabled={hasParticipants} onChange={(e) => set('type', e.target.value as CampaignFormValue['type'])}>
            <option value="PROMOTION">Promotion (offer + products)</option>
            <option value="FILL_YOUR_CART">Fill Your Cart (pre-launch demand)</option>
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="cp-slug">URL slug</label>
          <input id="cp-slug" className={`${inputCls} font-mono`} value={v.slug} maxLength={80} placeholder="auto from name" onChange={(e) => set('slug', e.target.value.toLowerCase())} />
          <p className="mt-0.5 text-[10px] text-gray-400">/campaigns/{v.slug || '…'}</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="cp-coupon">Campaign coupon (optional)</label>
          <select id="cp-coupon" className={inputCls} value={v.couponId ?? ''} onChange={(e) => set('couponId', e.target.value || null)}>
            <option value="">None</option>
            {coupons.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
                {c.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
          <p className="mt-0.5 text-[10px] text-gray-400">{fyc ? 'Issued once to each customer who joins.' : 'Shown on the page when it is a public, live coupon.'}</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="cp-start">Starts</label>
          <input id="cp-start" type="datetime-local" className={inputCls} value={starts} onChange={(e) => setStarts(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="cp-end">Ends</label>
          <input id="cp-end" type="datetime-local" className={inputCls} value={ends} onChange={(e) => setEnds(e.target.value)} />
          {fe('endsAt') && <p className="mt-0.5 text-[10px] text-red-600">{fe('endsAt')}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="cp-bt">Banner title</label>
          <input id="cp-bt" className={inputCls} value={v.bannerTitle ?? ''} maxLength={120} onChange={(e) => set('bannerTitle', e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="cp-bs">Banner subtitle</label>
          <input id="cp-bs" className={inputCls} value={v.bannerSubtitle ?? ''} maxLength={240} onChange={(e) => set('bannerSubtitle', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="cp-desc">Description</label>
          <textarea id="cp-desc" className={textareaCls} rows={3} maxLength={2000} value={v.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </div>
        {fyc && (
          <div>
            <label className={labelCls} htmlFor="cp-maxq">Max quantity per item</label>
            <input id="cp-maxq" type="number" min={1} max={99} className={inputCls} value={v.maxQtyPerItem} onChange={(e) => set('maxQtyPerItem', Math.min(99, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor="cp-order">Homepage order</label>
          <input id="cp-order" type="number" min={0} className={inputCls} value={v.displayOrder} onChange={(e) => set('displayOrder', Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={v.isActive} onChange={(e) => set('isActive', e.target.checked)} /> <span className="font-semibold">Active</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={v.showOnHomepage} onChange={(e) => set('showOnHomepage', e.target.checked)} /> <span className="font-semibold">Show on homepage while live</span>
          </label>
        </div>
        <div className="sm:col-span-2">
          {canEdit ? <ProductPicker label="Campaign products" value={v.products} onChange={(p) => set('products', p)} /> : <p>{v.products.length} product(s)</p>}
          {fyc && <p className="mt-1 text-[10px] text-gray-400">Customers can only save these products. Leave empty to allow any visible product.</p>}
        </div>
      </fieldset>
      {v.id && canUpload && (
        <ImageUploadField endpoint={`/api/admin/campaigns/${v.id}/banner`} currentUrl={v.bannerImageUrl} label="Banner image" onUploaded={(url) => { set('bannerImageUrl', url); router.refresh(); }} />
      )}
      {!v.id && <p className="text-[10px] text-gray-400">You can upload a banner image after creating the campaign.</p>}
      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="brand" isLoading={saving}>
            {v.id ? 'Save changes' : 'Create campaign'}
          </Button>
        </div>
      )}
    </form>
  );
}
