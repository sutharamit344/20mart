'use client';

import React, { useState } from 'react';
import { AccountLayout } from '../../../components/AccountLayout';
import { useStore } from '../../../lib/store';
import { Button, Modal, Input } from '@20mart/ui';
import { MapPin, Plus, Trash2, Edit2, CheckCircle2 } from 'lucide-react';

export default function ManageAddressesPage() {
  const { addresses, addAddress, selectAddress, selectedAddress, showToast } = useStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('Amit Kumar');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [line1, setLine1] = useState('');
  const [locality, setLocality] = useState('Chanakyapuri');
  const [city, setCity] = useState('Ahmedabad');
  const [pincode, setPincode] = useState('380061');
  const [type, setType] = useState<'Home' | 'Work' | 'Other'>('Home');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!line1.trim()) return;
    addAddress({
      name,
      phone,
      addressLine1: line1,
      locality,
      city,
      state: 'Gujarat',
      pincode,
      type,
      isDefault: addresses.length === 0,
    });
    setModalOpen(false);
    setLine1('');
    showToast('Address added successfully!');
  };

  return (
    <AccountLayout
      title="Manage Addresses"
      subtitle="Save your home, office, and family delivery locations for 1-click checkout."
      activeKey="addresses"
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="primary"
            onClick={() => setModalOpen(true)}
            className="font-bold gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Address</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {addresses.map((addr) => {
            const isSelected = selectedAddress?.id === addr.id;
            return (
              <div
                key={addr.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? 'border-[#0B5D3B] bg-emerald-50/20 ring-1 ring-[#0B5D3B]'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md uppercase">
                      {addr.type}
                    </span>
                    {addr.isDefault && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        <span>Default</span>
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-gray-900">{addr.name}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {addr.addressLine1}, {addr.locality ? `${addr.locality}, ` : ''}
                    {addr.city} – {addr.pincode}
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium">{addr.phone}</p>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => selectAddress(addr.id)}
                    className="text-xs font-bold text-[#FF7A00] hover:underline"
                  >
                    {isSelected ? 'Selected' : 'Set as Default'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Address Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Delivery Address"
      >
        <form onSubmit={handleSave} className="space-y-3">
          <Input
            label="Full Name"
            placeholder="Recipient's Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Phone Number"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input
            label="House / Flat / Building / Street"
            placeholder="A-21, Chanakyapuri"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
            <Input
              label="Pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Address Type</label>
            <div className="flex gap-2">
              {(['Home', 'Work', 'Other'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold ${
                    type === t
                      ? 'border-[#0B5D3B] bg-emerald-50 text-[#0B5D3B] font-bold'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary">
              Save Address
            </Button>
          </div>
        </form>
      </Modal>
    </AccountLayout>
  );
}

