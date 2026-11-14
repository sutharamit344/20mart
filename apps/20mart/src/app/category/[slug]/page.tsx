import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { mockCategories, mockProducts } from '@20mart/shared';
import { CategoryDetailView } from '../../../components/CategoryDetailView';

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  return mockCategories.map((c) => ({
    slug: c.slug,
  }));
}

export function generateMetadata({ params }: CategoryPageProps): Metadata {
  const category = mockCategories.find((c) => c.slug === params.slug);

  if (!category) {
    return {
      title: 'Category Not Found – 20Mart',
    };
  }

  return {
    title: `${category.name} Essentials – 20Mart`,
    description: `Shop budget-friendly ${category.name.toLowerCase()} products at 20Mart. Free delivery over ₹199.`,
  };
}

export default function CategoryDetailPage({ params }: CategoryPageProps) {
  const category = mockCategories.find((c) => c.slug === params.slug);

  if (!category) {
    notFound();
  }

  return (
    <CategoryDetailView
      category={category}
      allProducts={mockProducts}
    />
  );
}
