export interface BusinessConfigurations {
  general: {
    storeName: string;
    tagline: string;
    supportEmail: string;
    supportPhone: string;
    operatingCity: string;
    currencySymbol: string;
    maintenanceMode: boolean;
  };
  shopping: {
    minCartValue: number;
    freeDeliveryThreshold: number;
    maxQuantityPerProduct: number;
    cartExpiryDays: number;
    allowGuestBrowsing: boolean;
    requirePhoneVerificationOnCheckout: boolean;
  };
  product: {
    lowStockThreshold: number;
    showOutOfStockBadge: boolean;
    enableCustomerReviews: boolean;
    requirePurchaseForReview: boolean;
    allowVariantSelection: boolean;
  };
  coupon: {
    maxDiscountPerOrder: number;
    allowCouponStacking: boolean;
    autoApplyWelcomeCoupon: boolean;
    defaultValidityDays: number;
    minOrderValueForCoupons: number;
  };
  question: {
    surveyQuestionsCount: number;
    surveyRequiredForReward: boolean;
    questionCooldownDays: number;
    autoSuggestCategories: boolean;
  };
  reward: {
    launchCouponValue: number;
    surveyRewardValue: number;
    referralRewardValue: number;
    minOrderForRewardRedemption: number;
  };
  delivery: {
    standardDeliveryCharge: number;
    expressDeliveryCharge: number;
    storePickupAvailable: boolean;
    estimatedDeliveryDays: string;
    deliveryTimeSlots: string[];
  };
  payment: {
    enableUPI: boolean;
    enableCards: boolean;
    enableCashOnDelivery: boolean;
    codAdditionalFee: number;
    codMaxLimit: number;
  };
  notification: {
    enableSmsOrderUpdates: boolean;
    enableEmailReceipts: boolean;
    enablePromoNotifications: boolean;
    smsSenderId: string;
  };
  features: {
    enableEarlyAccessBanner: boolean;
    enableDailyDealsSection: boolean;
    enableTrendingSection: boolean;
    enableProductSurveyReward: boolean;
    enableWishlist: boolean;
  };
  platform: {
    apiRateLimitPerMinute: number;
    sessionTimeoutMinutes: number;
    enforceStrongPasswords: boolean;
    allowAdminImpersonation: boolean;
    auditLogRetentionDays: number;
  };
}

export const defaultBusinessConfigurations: BusinessConfigurations = {
  general: {
    storeName: '20Mart',
    tagline: 'Your Everyday Value Market',
    supportEmail: 'support@20mart.in',
    supportPhone: '+91 98765 43210',
    operatingCity: 'Ahmedabad',
    currencySymbol: '₹',
    maintenanceMode: false,
  },
  shopping: {
    minCartValue: 50,
    freeDeliveryThreshold: 199,
    maxQuantityPerProduct: 10,
    cartExpiryDays: 30,
    allowGuestBrowsing: true,
    requirePhoneVerificationOnCheckout: true,
  },
  product: {
    lowStockThreshold: 15,
    showOutOfStockBadge: true,
    enableCustomerReviews: true,
    requirePurchaseForReview: true,
    allowVariantSelection: true,
  },
  coupon: {
    maxDiscountPerOrder: 500,
    allowCouponStacking: false,
    autoApplyWelcomeCoupon: false,
    defaultValidityDays: 30,
    minOrderValueForCoupons: 99,
  },
  question: {
    surveyQuestionsCount: 3,
    surveyRequiredForReward: true,
    questionCooldownDays: 7,
    autoSuggestCategories: true,
  },
  reward: {
    launchCouponValue: 50,
    surveyRewardValue: 50,
    referralRewardValue: 30,
    minOrderForRewardRedemption: 99,
  },
  delivery: {
    standardDeliveryCharge: 40,
    expressDeliveryCharge: 70,
    storePickupAvailable: true,
    estimatedDeliveryDays: '2-4 days',
    deliveryTimeSlots: ['09:00 AM - 12:00 PM', '02:00 PM - 05:00 PM', '06:00 PM - 09:00 PM'],
  },
  payment: {
    enableUPI: true,
    enableCards: true,
    enableCashOnDelivery: true,
    codAdditionalFee: 0,
    codMaxLimit: 2000,
  },
  notification: {
    enableSmsOrderUpdates: true,
    enableEmailReceipts: true,
    enablePromoNotifications: true,
    smsSenderId: '20MART',
  },
  features: {
    enableEarlyAccessBanner: true,
    enableDailyDealsSection: true,
    enableTrendingSection: true,
    enableProductSurveyReward: true,
    enableWishlist: true,
  },
  platform: {
    apiRateLimitPerMinute: 120,
    sessionTimeoutMinutes: 60,
    enforceStrongPasswords: true,
    allowAdminImpersonation: false,
    auditLogRetentionDays: 90,
  },
};

