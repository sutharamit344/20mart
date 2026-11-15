'use client';

import React, { useState } from 'react';
import { Breadcrumb, Button } from '@20mart/ui';
import { useStore } from '../../lib/store';
import {
  Send,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Truck,
  Check,
  RefreshCw,
} from 'lucide-react';

export default function ContactPage() {
  const { showToast } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('Order & Delivery Inquiry');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<{
    ticketNumber: string;
    name: string;
    email: string;
    subject: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      showToast('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          subject,
          message: message.trim(),
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.inquiry?.ticketNumber) {
        // Only a ticket number issued by the server is ever shown.
        const ticketNum: string = data.inquiry.ticketNumber;
        setSubmittedTicket({ ticketNumber: ticketNum, name: name.trim(), email: email.trim(), subject });
        showToast(`Inquiry #${ticketNum} submitted successfully!`);
      } else {
        showToast(data?.error ?? 'Your message could not be sent. Please check the form and try again.');
      }
    } catch {
      showToast('Network error — your message was not sent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setSubject('Order & Delivery Inquiry');
    setMessage('');
    setSubmittedTicket(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2.5 pb-8 sm:pt-3.5 space-y-4 sm:space-y-5">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Contact Us' },
        ]}
        className="mb-1.5 sm:mb-2"
      />

      {/* Header Banner - Compact & Minimal */}
      <div className="text-center space-y-1.5 max-w-xl mx-auto pb-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-50 text-[#0B5D3B] text-[11px] font-bold border border-emerald-100">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Customer Care & Helpdesk</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
          How Can We Help You Today?
        </h1>
        <p className="text-xs text-gray-500">
          Have a question about an order, delivery timing, or product? Submit your inquiry below and our team will get back to you promptly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-8 items-start">
        {/* Contact Form Container */}
        <div className="md:col-span-7 rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-3 flex items-center justify-between">
            <span>Send Customer Support a Message</span>
            <span className="text-[10px] font-semibold text-gray-400">* Required fields</span>
          </h2>

          {submittedTicket ? (
            <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-5 sm:p-6 text-center space-y-3.5 animate-in fade-in duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Inquiry Logged
                </span>
                <h3 className="text-lg font-black text-emerald-950 mt-0.5">
                  Ticket #{submittedTicket.ticketNumber}
                </h3>
                <p className="text-xs text-emerald-800/90 mt-1 max-w-md mx-auto leading-relaxed">
                  Thank you, <strong>{submittedTicket.name}</strong>. Your message regarding{' '}
                  <em>"{submittedTicket.subject}"</em> has been received by our support team.
                </p>
              </div>

              <div className="bg-white/80 rounded-xl p-3 max-w-sm mx-auto border border-emerald-200/60 text-left text-xs space-y-1">
                <div className="flex items-center justify-between text-gray-500 text-[11px]">
                  <span>Confirmation sent to:</span>
                  <span className="font-bold text-gray-900">{submittedTicket.email}</span>
                </div>
                <div className="flex items-center justify-between text-gray-500 text-[11px]">
                  <span>Target response time:</span>
                  <span className="font-bold text-emerald-700">Within 24 Hours</span>
                </div>
              </div>

              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReset}
                  className="rounded-xl font-bold bg-white"
                >
                  Submit Another Inquiry
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Amit Kumar"
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-xs focus:border-[#FF7A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="amit@example.com"
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-xs focus:border-[#FF7A00] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98250 00000"
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-xs focus:border-[#FF7A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Subject Category</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-xs focus:border-[#FF7A00] focus:outline-none bg-white font-medium"
                  >
                    <option value="Order & Delivery Inquiry">Order & Delivery Inquiry</option>
                    <option value="Product Quality / Replacement Request">
                      Product Quality / Replacement Request
                    </option>
                    <option value="Coupon & Rewards Assistance">Coupon & Rewards Assistance</option>
                    <option value="Partnership & Bulk Procurement">
                      Partnership & Bulk Procurement
                    </option>
                    <option value="General Feedback">General Feedback</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Your Message *</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your question or order details..."
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs focus:border-[#FF7A00] focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                size="md"
                variant="primary"
                disabled={isSubmitting}
                rightIcon={
                  isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )
                }
                className="w-full rounded-xl font-bold py-2.5 shadow-xs"
              >
                {isSubmitting ? 'Submitting Ticket...' : 'Send Inquiry'}
              </Button>
            </form>
          )}
        </div>

        {/* Right Info Cards: Verified Support Policies & Help Channels */}
        <div className="md:col-span-5 space-y-3.5">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
              Customer Support & Guarantees
            </h3>

            {/* 24/7 Digital Help Desk */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-orange-50 text-[#FF7A00] shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">
                  24/7 Digital Help Desk
                </span>
                <p className="font-bold text-gray-900 mt-0.5">Online Ticketing System</p>
                <p className="text-[11px] text-gray-400">
                  Submit inquiries directly through our portal for quick review and tracking.
                </p>
              </div>
            </div>

            {/* Replacement Guarantee */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-700 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">
                  Damage Protection
                </span>
                <p className="font-bold text-gray-900 mt-0.5">Courier Damage Replacement</p>
                <p className="text-[11px] text-gray-400">
                  Item damaged during delivery? Free replacement dispatched within 48 hours.
                </p>
              </div>
            </div>

            {/* Quality Assurance */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-[#0B5D3B] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">
                  100% Quality Checked
                </span>
                <p className="font-bold text-gray-900 mt-0.5">Direct Everyday Essentials</p>
                <p className="text-[11px] text-gray-400">
                  Carefully vetted utility essentials delivered fresh to your doorstep.
                </p>
              </div>
            </div>
          </div>

          {/* Service Areas Card */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
              <Truck className="w-3.5 h-3.5 text-[#0B5D3B]" />
              <span>Doorstep Delivery Areas</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Serving households across Gujarat: <strong>Ahmedabad</strong>, <strong>Gandhinagar</strong>, <strong>Vadodara</strong>, <strong>Surat</strong>, and <strong>Rajkot</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
