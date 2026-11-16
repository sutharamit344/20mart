import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatPaise } from '@20mart/shared';
import { ProductDetailView } from '../../../components/ProductDetailView';
import { getProduct, getProducts, getRelated } from '../../../lib/catalog';
import { breadcrumbJsonLd, pageMetadata, productJsonLd } from '../../../lib/seo';
import { JsonLd } from '../../../components/JsonLd';

export const revalidate = 60;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/** Pre-render the most relevant products at build time; others render on first request (ISR). */
export async function generateStaticParams() {
  try {
    return (await getProducts({ pageSize: 48 })).items.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata(props: ProductPageProps): Promise<Metadata> {
  const params = await props.params;
  const product = await getProduct(params.slug).catch(() => null);
  if (!product) return { title: 'Product not found – 20Mart' };
  const title = product.seoTitle || `${product.name} – ${formatPaise(product.sellingPricePaise)} | 20Mart`;
  const description = product.seoDescription || product.shortDescription || product.description?.slice(0, 160) || `Buy ${product.name} at 20Mart.`;
  return pageMetadata({
    title,
    description,
    path: `/product/${product.slug}`,
    images: product.images.slice(0, 4).map((i) => ({ url: i.url, alt: i.alt })),
  });
}

export default async function ProductDetailPage(props: ProductPageProps) {
  const params = await props.params;
  // Only ACTIVE products in active categories/brands are returned; anything else is a 404.
  const product = await getProduct(params.slug);
  if (!product) notFound();
  const relatedProducts = await getRelated(product.id, product.category.slug).catch(() => []);
  return (
    <>
      <JsonLd
        data={[
          productJsonLd(product),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: product.category.name, path: `/category/${product.category.slug}` },
            { name: product.name, path: `/product/${product.slug}` },
          ]),
        ]}
      />
      <ProductDetailView product={product} relatedProducts={relatedProducts} />
    </>
  );
}
