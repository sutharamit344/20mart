'use client';

import React, { useState } from 'react';
import { useAdmin } from '../../lib/admin-store';
import { Button, Modal } from '@20mart/ui';
import { Plus, HelpCircle, Trash2, CheckCircle2 } from 'lucide-react';

export default function QuestionsManagementPage() {
  const { questions, addQuestion, deleteQuestion } = useAdmin();

  const [modalOpen, setModalOpen] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [option1, setOption1] = useState('Very useful');
  const [option2, setOption2] = useState('Affordable');
  const [option3, setOption3] = useState('Good quality');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;
    addQuestion({
      question: questionText,
      options: [
        { id: `opt-${Date.now()}-1`, text: option1 },
        { id: `opt-${Date.now()}-2`, text: option2 },
        { id: `opt-${Date.now()}-3`, text: option3 },
      ],
    });
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Product Interest Questions</h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure consumer survey questions that unlock the ₹50 Survey Bonus coupon.
          </p>
        </div>
        <Button
          size="md"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setQuestionText('What feature did you like most about this product?');
            setModalOpen(true);
          }}
          className="rounded-xl font-bold"
        >
          Add Question
        </Button>
      </div>

      {/* Analytics Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-xs space-y-1">
          <span className="text-xs font-bold text-gray-500">Active Questions</span>
          <p className="text-2xl font-black text-gray-900">{questions.length}</p>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-xs space-y-1">
          <span className="text-xs font-bold text-gray-500">Completed Surveys</span>
          <p className="text-2xl font-black text-[#0B5D3B]">1,840</p>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-xs space-y-1">
          <span className="text-xs font-bold text-gray-500">Survey Reward Unlocks</span>
          <p className="text-2xl font-black text-[#FF7A00]">₹92,000</p>
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="font-bold text-xs uppercase tracking-wider text-[#FF7A00]">
                Question #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => deleteQuestion(q.id)}
                className="text-gray-400 hover:text-red-500 p-1"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-sm font-bold text-gray-900">{q.question}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
              {q.options.map((opt) => (
                <div
                  key={opt.id}
                  className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs font-medium text-gray-700 flex items-center justify-between"
                >
                  <span>{opt.text}</span>
                  {opt.isRecommended && (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Top Pick
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Survey Question">
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Question Prompt *</label>
            <input
              type="text"
              required
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-bold text-gray-700">Answer Options *</label>
            <input
              type="text"
              required
              value={option1}
              onChange={(e) => setOption1(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5"
              placeholder="Option 1"
            />
            <input
              type="text"
              required
              value={option2}
              onChange={(e) => setOption2(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5"
              placeholder="Option 2"
            />
            <input
              type="text"
              required
              value={option3}
              onChange={(e) => setOption3(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5"
              placeholder="Option 3"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="brand">
              Save Question
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

