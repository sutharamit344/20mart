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
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-success-soft text-brand-green text-2xs font-bold border border-success-line">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Customer Care & Helpdesk</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
          How Can We Help You Today?
        </h1>
        <p className="text-xs text-ink-500">
          Have a question about an order, delivery timing, or product? Submit your inquiry below and our team will get back to you promptly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-8 items-start">
        {/* Contact Form Container */}
        <div className="md:col-span-7 rounded-2xl border border-line-subtle bg-surface p-4 sm:p-6 ">
          <h2 className="text-sm sm:text-base font-bold text-ink mb-3 flex items-center justify-between">
            <span>Send Customer Support a Message</span>
            <span className="text-2xs font-semibold text-ink-400">* Required fields</span>
          </h2>

          {submittedTicket ? (
            <div className="rounded-2xl bg-success-soft border border-success-line p-5 sm:p-6 text-center space-y-3.5 animate-in fade-in duration-200">
              <div className="w-12 h-12 rounded-full bg-success text-white flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>

              <div>
                <span className="text-2xs font-bold uppercase tracking-wider text-success">
                  Inquiry Logged
                </span>
                <h3 className="text-lg font-bold text-success mt-0.5">
                  Ticket #{submittedTicket.ticketNumber}
                </h3>
                <p className="text-xs text-success/90 mt-1 max-w-md mx-auto leading-relaxed">
                  Thank you, <strong>{submittedTicket.name}</strong>. Your message regarding{' '}
                  <em>"{submittedTicket.subject}"</em> has been received by our support team.
                </p>
              </div>

              <div className="bg-surface/80 rounded-xl p-3 max-w-sm mx-auto border border-success-line/60 text-left text-xs space-y-1">
                <div className="flex items-center justify-between text-ink-500 text-2xs">
                  <span>Confirmation sent to:</span>
                  <span className="font-bold text-ink">{submittedTicket.email}</span>
                </div>
                <div className="flex items-center justify-between text-ink-500 text-2xs">
                  <span>Target response time:</span>
                  <span className="font-bold text-success">Within 24 Hours</span>
                </div>
              </div>

              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReset}
                  className="rounded-xl font-bold bg-surface"
                >
                  Submit Another Inquiry
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-ink-700 mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Amit Kumar"
                    className="w-full rounded-xl border border-line p-2.5 text-xs focus:border-brand-orange focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-ink-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="amit@example.com"
                    className="w-full rounded-xl border border-line p-2.5 text-xs focus:border-brand-orange focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-ink-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98250 00000"
                    className="w-full rounded-xl border border-line p-2.5 text-xs focus:border-brand-orange focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-ink-700 mb-1">Subject Category</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-line p-2.5 text-xs focus:border-brand-orange focus:outline-none bg-surface font-medium"
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
                <label className="block font-bold text-ink-700 mb-1">Your Message *</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your question or order details..."
                  className="w-full rounded-xl border border-line p-2.5 text-xs focus:border-brand-orange focus:outline-none"
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
                className="w-full rounded-xl font-bold py-2.5 "
              >
                {isSubmitting ? 'Submitting Ticket...' : 'Send Inquiry'}
              </Button>
            </form>
          )}
        </div>

        {/* Right Info Cards: Verified Support Policies & Help Channels */}
        <div className="md:col-span-5 space-y-3.5">
          <div className="rounded-2xl border border-line-subtle bg-surface p-4 sm:p-5 space-y-3.5">
            <h3 className="text-xs sm:text-sm font-bold text-ink border-b border-line-subtle pb-2">
              Customer Support & Guarantees
            </h3>

            {/* 24/7 Digital Help Desk */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-brand-orange-50 text-brand-orange shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-ink-400 font-semibold block text-2xs uppercase tracking-wider">
                  24/7 Digital Help Desk
                </span>
                <p className="font-bold text-ink mt-0.5">Online Ticketing System</p>
                <p className="text-2xs text-ink-400">
                  Submit inquiries directly through our portal for quick review and tracking.
                </p>
              </div>
            </div>

            {/* Replacement Guarantee */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-info-soft text-info shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-ink-400 font-semibold block text-2xs uppercase tracking-wider">
                  Damage Protection
                </span>
                <p className="font-bold text-ink mt-0.5">Courier Damage Replacement</p>
                <p className="text-2xs text-ink-400">
                  Item damaged during delivery? Free replacement dispatched within 48 hours.
                </p>
              </div>
            </div>

            {/* Quality Assurance */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-success-soft text-brand-green shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-ink-400 font-semibold block text-2xs uppercase tracking-wider">
                  100% Quality Checked
                </span>
                <p className="font-bold text-ink mt-0.5">Direct Everyday Essentials</p>
                <p className="text-2xs text-ink-400">
                  Carefully vetted utility essentials delivered fresh to your doorstep.
                </p>
              </div>
            </div>
          </div>

          {/* Service Areas Card */}
          <div className="rounded-2xl border border-line-subtle bg-surface p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <Truck className="w-3.5 h-3.5 text-brand-green" />
              <span>Doorstep Delivery Areas</span>
            </div>
            <p className="text-xs text-ink-500 leading-relaxed">
              Serving households across Gujarat: <strong>Ahmedabad</strong>, <strong>Gandhinagar</strong>, <strong>Vadodara</strong>, <strong>Surat</strong>, and <strong>Rajkot</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
