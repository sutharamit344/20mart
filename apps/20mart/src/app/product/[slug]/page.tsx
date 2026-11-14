import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatPaise } from '@20mart/shared';
import { ProductDetailView } from '../../../components/ProductDetailView';
import { getProduct, getProducts, getRelated } from '../../../lib/catalog';

export const revalidate = 60;

interface ProductPageProps {
  params: { slug: string };
}

/** Pre-render the most relevant products at build time; others render on first request (ISR). */
export async function generateStaticParams() {
  try {
    return (await getProducts({ pageSize: 48 })).items.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await getProduct(params.slug).catch(() => null);
  if (!product) return { title: 'Product not found – 20Mart' };
  const title = product.seoTitle || `${product.name} – ${formatPaise(product.sellingPricePaise)} | 20Mart`;
  const description = product.seoDescription || product.shortDescription || product.description?.slice(0, 160) || undefined;
  return {
    title,
    description,
    openGraph: { title, description, images: product.image ? [{ url: product.image.url }] : [] },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  // Only ACTIVE products in active categories/brands are returned; anything else is a 404.
  const product = await getProduct(params.slug);
  if (!product) notFound();
  const relatedProducts = await getRelated(product.id, product.category.slug).catch(() => []);
  return <ProductDetailView product={product} relatedProducts={relatedProducts} />;
}
