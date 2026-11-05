'use client';

import React, { useState } from 'react';
import { Breadcrumb, Button } from '@20mart/ui';
import { useStore } from '../../lib/store';
import { Phone, Mail, MapPin, Send, MessageSquare } from 'lucide-react';

export default function ContactPage() {
  const { showToast } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Order & Delivery Inquiry');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    showToast('Your message has been sent! Our team will respond shortly.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Contact Us' },
        ]}
      />

      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Contact Us</h1>
        <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
          We are here to help! Reach out for order assistance, feedback, or business inquiries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Contact Form (Desktop Screen 17) */}
        <div className="md:col-span-7 rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs">
          <h2 className="text-base font-bold text-gray-900 mb-4">Send Us a Message</h2>

          {submitted ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-6 text-center space-y-3">
              <h3 className="text-sm font-bold text-emerald-900">Thank You!</h3>
              <p className="text-xs text-emerald-700">
                Your message has been received. Our customer support executive will get back to you within 24 hours.
              </p>
              <Button size="sm" variant="outline" onClick={() => setSubmitted(false)}>
                Send Another Message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Amit Kumar"
                  className="w-full rounded-xl border border-gray-200 p-3 focus:border-[#FF7A00] focus:outline-none"
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
                  className="w-full rounded-xl border border-gray-200 p-3 focus:border-[#FF7A00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-3 focus:border-[#FF7A00] focus:outline-none"
                >
                  <option value="Order & Delivery Inquiry">Order & Delivery Inquiry</option>
                  <option value="Product Quality / Return">Product Quality / Return</option>
                  <option value="Coupon / Rewards Assistance">Coupon / Rewards Assistance</option>
                  <option value="Partnership / Bulk Order">Partnership / Bulk Order</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Message *</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help you?"
                  className="w-full rounded-xl border border-gray-200 p-3 focus:border-[#FF7A00] focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                size="md"
                variant="primary"
                rightIcon={<Send className="w-3.5 h-3.5" />}
                className="w-full rounded-xl font-bold py-3 shadow-sm"
              >
                Send Message
              </Button>
            </form>
          )}
        </div>

        {/* Contact Information Cards (Desktop Screen 17) */}
        <div className="md:col-span-5 space-y-4">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Direct Contact</h3>

            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-orange-50 text-[#FF7A00]">
                <Phone className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-gray-400 font-medium">Customer Support Phone</span>
                <p className="font-bold text-gray-900 mt-0.5">+91 98765 43210</p>
                <p className="text-[11px] text-gray-400">Mon - Sat: 9:00 AM - 8:00 PM</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-[#0B5D3B]">
                <Mail className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-gray-400 font-medium">Email Support</span>
                <p className="font-bold text-gray-900 mt-0.5">support@20mart.in</p>
                <p className="text-[11px] text-gray-400">Queries resolved within 24 hours</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-gray-400 font-medium">Office & Fulfillment Center</span>
                <p className="font-bold text-gray-900 mt-0.5">
                  A-21, Shivalik Corporate Park, Chanakyapuri, Ahmedabad, Gujarat – 380061
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

