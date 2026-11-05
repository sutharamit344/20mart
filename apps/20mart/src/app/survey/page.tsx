'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mockSurveyQuestions, mockProducts } from '@20mart/shared';
import { Breadcrumb, Button } from '@20mart/ui';
import { useStore } from '../../lib/store';
import {
  Gift,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';

export default function ProductSurveyPage() {
  const router = useRouter();
  const { completeSurvey, surveyCompleted } = useStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({
    'sq-1': 'Useful for daily use',
  });
  const [isCompleted, setIsCompleted] = useState(surveyCompleted);

  const currentQ = mockSurveyQuestions[currentStep];
  const totalQuestions = mockSurveyQuestions.length;
  const sampleProduct = mockProducts[0]; // Kitchen peeler

  const handleSelectOption = (optionText: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionText,
    }));
  };

  const handleNext = () => {
    if (currentStep < totalQuestions - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeSurvey(selectedAnswers);
      setIsCompleted(true);
      router.push('/survey/reward');
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Product Interest Survey' },
        ]}
      />

      {isCompleted ? (
        <div className="rounded-3xl border border-emerald-100 bg-white p-8 sm:p-12 text-center shadow-md space-y-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 mx-auto shadow-sm">
            <Gift className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-100 text-emerald-800">
              Reward Unlocked!
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
              Thank You! You Received ₹50
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto">
              We added <span className="font-black text-[#FF7A00]">SURVEY50</span> to your coupons
              wallet. You can apply it directly to your shopping cart now!
            </p>
          </div>

          <div className="mx-auto max-w-sm rounded-2xl border-2 border-dashed border-[#FF7A00] bg-orange-50/60 p-4">
            <span className="text-[10px] uppercase font-bold text-gray-500">Your Coupon Code</span>
            <div className="text-xl font-black text-[#FF7A00] tracking-wider">SURVEY50</div>
            <span className="text-[11px] text-gray-500">Flat ₹50 off on orders ₹99+</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              variant="primary"
              onClick={() => router.push('/cart')}
              className="w-full sm:w-auto font-bold px-8 rounded-xl shadow-md"
            >
              Go to Cart & Apply
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/shop')}
              className="w-full sm:w-auto font-bold px-6 rounded-xl"
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          {/* Header & Product Association (Screen 15 & Mobile 11) */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h1 className="text-lg sm:text-xl font-black text-gray-900">
                Product Interest Survey
              </h1>
              <p className="text-xs text-gray-500">
                Answer 3 quick questions to unlock an exclusive ₹50 coupon
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-[#FF7A00]">
                {currentStep + 1} of {totalQuestions}
              </span>
            </div>
          </div>

          {/* Product Association Preview */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-white p-1 border border-gray-100 flex items-center justify-center">
              <img
                src={sampleProduct.images[0]}
                alt={sampleProduct.name}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400">Selected Product</span>
              <h3 className="text-xs font-bold text-gray-900">{sampleProduct.name}</h3>
            </div>
          </div>

          {/* Question Text */}
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Question {currentStep + 1}
            </span>
            <h2 className="text-base sm:text-lg font-black text-gray-900">
              {currentQ.question}
            </h2>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {currentQ.options.map((opt) => {
              const isSelected = selectedAnswers[currentQ.id] === opt.text;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.text)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#0B5D3B] bg-emerald-50/50 ring-1 ring-[#0B5D3B]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xs sm:text-sm font-semibold text-gray-800">
                    {opt.text}
                  </span>
                  <div
                    className={`flex h-4 w-4 shrink-0 rounded-full border items-center justify-center ${
                      isSelected ? 'border-[#0B5D3B] bg-[#0B5D3B]' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#FF7A00] h-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalQuestions) * 100}%` }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentStep === 0}
              onClick={handlePrev}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Back
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={!selectedAnswers[currentQ.id]}
              onClick={handleNext}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="rounded-xl font-bold px-6"
            >
              {currentStep === totalQuestions - 1 ? 'Finish & Unlock ₹50' : 'Next'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

