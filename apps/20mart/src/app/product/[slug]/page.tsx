import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { mockProducts } from '@20mart/shared';
import { ProductDetailView } from '../../../components/ProductDetailView';

interface ProductPageProps {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  return mockProducts.map((p) => ({
    slug: p.slug,
  }));
}

export function generateMetadata({ params }: ProductPageProps): Metadata {
  const product =
    mockProducts.find((p) => p.slug === params.slug) ||
    mockProducts.find((p) => p.id === params.slug);

  if (!product) {
    return {
      title: 'Product Not Found – 20Mart',
    };
  }

  return {
    title: `${product.name} – ₹${product.price} | 20Mart`,
    description: product.description,
    openGraph: {
      title: `${product.name} – ₹${product.price}`,
      description: product.description,
      images: product.images?.[0] ? [{ url: product.images[0] }] : [],
    },
  };
}

export default function ProductDetailPage({ params }: ProductPageProps) {
  const product =
    mockProducts.find((p) => p.slug === params.slug) ||
    mockProducts.find((p) => p.id === params.slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = mockProducts
    .filter((p) => p.id !== product.id && p.categorySlug === product.categorySlug)
    .slice(0, 5);

  return (
    <ProductDetailView
      product={product}
      relatedProducts={relatedProducts}
    />
  );
}
