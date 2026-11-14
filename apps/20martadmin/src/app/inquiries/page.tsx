'use client';

import React, { useState, useMemo } from 'react';
import { useAdmin } from '../../lib/admin-store';
import { ContactInquiry } from '@20mart/shared';
import { Button, Drawer, Modal } from '@20mart/ui';
import {
  MessageSquare,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Mail,
  Phone,
  Trash2,
  Calendar,
  Send,
  User,
  ShieldCheck,
  Check,
  X,
  FileText,
} from 'lucide-react';

export default function CustomerInquiriesPage() {
  const { inquiries, updateInquiryStatus, addInquiry, deleteInquiry, showToast } = useAdmin();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ContactInquiry['status']>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'HIGH' | 'NORMAL' | 'LOW'>('ALL');

  // Selected Inquiry for Drawer
  const [selectedInquiry, setSelectedInquiry] = useState<ContactInquiry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminNotesInput, setAdminNotesInput] = useState('');

  // Add Inquiry Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newSubject, setNewSubject] = useState('Order & Delivery Inquiry');
  const [newPriority, setNewPriority] = useState<ContactInquiry['priority']>('NORMAL');
  const [newMessage, setNewMessage] = useState('');

  // Metrics
  const totalCount = inquiries.length;
  const newCount = inquiries.filter((i) => i.status === 'NEW').length;
  const inProgressCount = inquiries.filter((i) => i.status === 'IN_PROGRESS').length;
  const resolvedCount = inquiries.filter((i) => i.status === 'RESOLVED').length;
  const closedCount = inquiries.filter((i) => i.status === 'CLOSED').length;

  // Filtered List
  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      // Status filter
      if (statusFilter !== 'ALL' && inq.status !== statusFilter) return false;

      // Priority filter
      if (priorityFilter !== 'ALL' && inq.priority !== priorityFilter) return false;

      // Search keyword
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = inq.name.toLowerCase().includes(q);
        const matchEmail = inq.email.toLowerCase().includes(q);
        const matchPhone = inq.phone?.toLowerCase().includes(q);
        const matchTicket = inq.ticketNumber.toLowerCase().includes(q);
        const matchSubject = inq.subject.toLowerCase().includes(q);
        const matchMessage = inq.message.toLowerCase().includes(q);
        return matchName || matchEmail || matchPhone || matchTicket || matchSubject || matchMessage;
      }

      return true;
    });
  }, [inquiries, statusFilter, priorityFilter, searchTerm]);

  const handleOpenDetails = (inq: ContactInquiry) => {
    setSelectedInquiry(inq);
    setAdminNotesInput(inq.adminNotes || '');
    setDrawerOpen(true);
  };

  const handleSaveNotes = () => {
    if (!selectedInquiry) return;
    updateInquiryStatus(selectedInquiry.id, selectedInquiry.status, adminNotesInput);
    setSelectedInquiry({ ...selectedInquiry, adminNotes: adminNotesInput });
    showToast('Admin notes saved successfully');
  };

  const handleStatusChange = (status: ContactInquiry['status']) => {
    if (!selectedInquiry) return;
    updateInquiryStatus(selectedInquiry.id, status, adminNotesInput);
    setSelectedInquiry({ ...selectedInquiry, status });
  };

  const handleCreateInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newMessage.trim()) {
      showToast('Please fill all required fields');
      return;
    }

    addInquiry({
      name: newName.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim() || undefined,
      subject: newSubject,
      priority: newPriority,
      message: newMessage.trim(),
      status: 'NEW',
    });

    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewSubject('Order & Delivery Inquiry');
    setNewPriority('NORMAL');
    setNewMessage('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span>Customer Inquiries & Support</span>
            {newCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-[#FF7A00] text-xs font-black">
                {newCount} New
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Review messages, support tickets, and contact requests submitted by storefront customers.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-xl font-bold"
        >
          Log New Inquiry
        </Button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold">Total Inquiries</span>
            <div className="p-2 rounded-xl bg-gray-50 text-gray-700">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{totalCount}</p>
          <span className="text-[11px] text-gray-400 mt-0.5 block">All lifetime tickets</span>
        </div>

        {/* New / Pending */}
        <div className="rounded-2xl border border-orange-100/80 bg-orange-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#FF7A00] mb-2">
            <span className="text-xs font-bold">Needs Attention</span>
            <div className="p-2 rounded-xl bg-orange-100 text-[#FF7A00]">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#FF7A00]">{newCount}</p>
          <span className="text-[11px] text-orange-600/80 mt-0.5 block font-medium">Unaddressed new tickets</span>
        </div>

        {/* In Progress */}
        <div className="rounded-2xl border border-blue-100/80 bg-blue-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between text-blue-700 mb-2">
            <span className="text-xs font-bold">In Progress</span>
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-900">{inProgressCount}</p>
          <span className="text-[11px] text-blue-600/80 mt-0.5 block font-medium">Being handled by staff</span>
        </div>

        {/* Resolved */}
        <div className="rounded-2xl border border-emerald-100/80 bg-emerald-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#0B5D3B] mb-2">
            <span className="text-xs font-bold">Resolved</span>
            <div className="p-2 rounded-xl bg-emerald-100 text-[#0B5D3B]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#0B5D3B]">{resolvedCount}</p>
          <span className="text-[11px] text-emerald-600/80 mt-0.5 block font-medium">Successfully completed</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'All', count: totalCount },
            { id: 'NEW', label: 'New', count: newCount },
            { id: 'IN_PROGRESS', label: 'In Progress', count: inProgressCount },
            { id: 'RESOLVED', label: 'Resolved', count: resolvedCount },
            { id: 'CLOSED', label: 'Closed', count: closedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#0B5D3B] text-white shadow-xs'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Priority Controls */}
        <div className="flex items-center gap-2">
          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#FF7A00]"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="NORMAL">Normal Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customer, ticket, text..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#FF7A00]"
            />
          </div>
        </div>
      </div>

      {/* Inquiries Data Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/80 uppercase font-bold text-gray-500 text-[10px] tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-5 py-3.5">Ticket</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Subject & Message</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Priority</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredInquiries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                    <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="font-bold text-gray-700 text-sm">No customer inquiries found</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {searchTerm || statusFilter !== 'ALL'
                        ? 'Try clearing the search or status filters.'
                        : 'New contact messages from customers will show up here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInquiries.map((inq) => {
                  const isNew = inq.status === 'NEW';
                  return (
                    <tr
                      key={inq.id}
                      onClick={() => handleOpenDetails(inq)}
                      className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${
                        isNew ? 'bg-orange-50/20 font-medium' : ''
                      }`}
                    >
                      {/* Ticket Number */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-gray-900">
                          {isNew && (
                            <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-pulse shrink-0" />
                          )}
                          <span>#{inq.ticketNumber}</span>
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#0B5D3B] font-bold text-[11px] flex items-center justify-center shrink-0">
                            {inq.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{inq.name}</p>
                            <p className="text-[11px] text-gray-400">{inq.email}</p>
                            {inq.phone && (
                              <p className="text-[10px] text-gray-500 font-mono mt-0.5">{inq.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Subject & Preview */}
                      <td className="px-5 py-3.5 max-w-xs sm:max-w-md">
                        <p className="font-bold text-gray-900 truncate">{inq.subject}</p>
                        <p className="text-gray-500 text-[11px] line-clamp-1 mt-0.5">{inq.message}</p>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-400 text-[11px]">
                        {inq.createdAt}
                      </td>

                      {/* Priority */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {inq.priority === 'HIGH' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-[10px] font-bold">
                            High
                          </span>
                        )}
                        {inq.priority === 'NORMAL' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-bold">
                            Normal
                          </span>
                        )}
                        {inq.priority === 'LOW' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">
                            Low
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {inq.status === 'NEW' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 text-[#FF7A00] text-[10px] font-black shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00]" />
                            <span>New</span>
                          </span>
                        )}
                        {inq.status === 'IN_PROGRESS' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                            <Clock className="w-3 h-3" />
                            <span>In Progress</span>
                          </span>
                        )}
                        {inq.status === 'RESOLVED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            <Check className="w-3 h-3" />
                            <span>Resolved</span>
                          </span>
                        )}
                        {inq.status === 'CLOSED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
                            Closed
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div
                          className="inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(inq)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#0B5D3B] hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="View inquiry details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteInquiry(inq.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete inquiry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inquiry Detail & Status Update Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedInquiry ? `Inquiry #${selectedInquiry.ticketNumber}` : 'Inquiry Details'}
        position="right"
      >
        {selectedInquiry && (
          <div className="space-y-5 pb-6">
            {/* Header Status & Time */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{selectedInquiry.createdAt}</span>
              </span>
              <div>
                {selectedInquiry.status === 'NEW' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-[#FF7A00] text-xs font-black">
                    New Ticket
                  </span>
                )}
                {selectedInquiry.status === 'IN_PROGRESS' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                    In Progress
                  </span>
                )}
                {selectedInquiry.status === 'RESOLVED' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                    Resolved
                  </span>
                )}
                {selectedInquiry.status === 'CLOSED' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                    Closed
                  </span>
                )}
              </div>
            </div>

            {/* Customer Details Box */}
            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0B5D3B] text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {selectedInquiry.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">{selectedInquiry.name}</h4>
                  <p className="text-xs text-gray-500">{selectedInquiry.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <a
                  href={`mailto:${selectedInquiry.email}?subject=Re: [${selectedInquiry.ticketNumber}] ${selectedInquiry.subject}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:text-[#0B5D3B] hover:border-emerald-300 shadow-2xs transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#0B5D3B]" />
                  <span>Send Email Reply</span>
                </a>
                {selectedInquiry.phone && (
                  <a
                    href={`tel:${selectedInquiry.phone}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:text-[#FF7A00] hover:border-orange-300 shadow-2xs transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#FF7A00]" />
                    <span>Call Customer</span>
                  </a>
                )}
              </div>
            </div>

            {/* Inquiry Content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Subject & Inquiry Category
                </span>
                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                  Priority: {selectedInquiry.priority}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-sm">{selectedInquiry.subject}</h3>
              <div className="rounded-xl border border-gray-200 bg-white p-3.5 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap shadow-2xs">
                {selectedInquiry.message}
              </div>
            </div>

            {/* Quick Status Updater */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="block text-xs font-bold text-gray-900">
                Update Ticket Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange('IN_PROGRESS')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedInquiry.status === 'IN_PROGRESS'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>In Progress</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange('RESOLVED')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedInquiry.status === 'RESOLVED'
                      ? 'border-emerald-500 bg-emerald-50 text-[#0B5D3B]'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark Resolved</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange('NEW')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedInquiry.status === 'NEW'
                      ? 'border-orange-500 bg-orange-50 text-[#FF7A00]'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Re-open / New</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange('CLOSED')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedInquiry.status === 'CLOSED'
                      ? 'border-gray-500 bg-gray-100 text-gray-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close Ticket</span>
                </button>
              </div>
            </div>

            {/* Internal Staff Notes */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="block text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#0B5D3B]" />
                <span>Internal Staff Notes</span>
              </label>
              <textarea
                rows={3}
                value={adminNotesInput}
                onChange={(e) => setAdminNotesInput(e.target.value)}
                placeholder="Log internal action taken, replacement tracking number, or resolution summary..."
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#FF7A00]"
              />
              <Button
                size="sm"
                variant="brand"
                onClick={handleSaveNotes}
                className="w-full rounded-xl font-bold"
              >
                Save Notes & Status
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Manual Inquiry Logger Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Log Customer Inquiry"
        maxWidth="md"
      >
        <form onSubmit={handleCreateInquiry} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Customer Full Name *</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Ramesh Patel"
              className="w-full rounded-xl border border-gray-200 p-2.5 text-xs focus:border-[#FF7A00] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="ramesh@example.com"
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs focus:border-[#FF7A00] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Phone Number (Optional)</label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+91 98980 12345"
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs focus:border-[#FF7A00] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Inquiry Subject</label>
              <select
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs focus:border-[#FF7A00] focus:outline-none"
              >
                <option value="Order & Delivery Inquiry">Order & Delivery Inquiry</option>
                <option value="Product Quality / Replacement Request">Product Quality / Replacement Request</option>
                <option value="Coupon & Rewards Assistance">Coupon & Rewards Assistance</option>
                <option value="Business / Bulk Inquiry">Business / Bulk Inquiry</option>
                <option value="Other Feedback">Other Feedback</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as any)}
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs focus:border-[#FF7A00] focus:outline-none"
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Customer Message / Inquiry *</label>
            <textarea
              required
              rows={4}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Enter customer message or phone conversation notes..."
              className="w-full rounded-xl border border-gray-200 p-2.5 text-xs focus:border-[#FF7A00] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" className="font-bold">
              Save Inquiry
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
