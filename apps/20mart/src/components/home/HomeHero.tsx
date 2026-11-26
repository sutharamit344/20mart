import React from "react";
import Link from "next/link";
import { ArrowRight, Truck, Tag } from "lucide-react";
import type { StorefrontProduct } from "@20mart/shared";
import { HeroShowcase } from "./HeroShowcase";

/**
 * Home hero: solid brand green, one primary CTA, factual delivery/price notes (the same ones shown in the
 * header and the shipping policy), and a quiet showcase of real in-stock products in a single row.
 */
export function HomeHero({ products }: { products: StorefrontProduct[] }) {
  return (
    <section
      className="mx-auto max-w-7xl sm:px-6"
      aria-labelledby="home-hero-title"
    >
      <div className="h-auto overflow-hidden bg-brand-green text-white sm:rounded-2xl">
        <div className="grid grid-cols-1 items-center md:grid-cols-12">
          <div className="space-y-3 px-4 py-5 sm:px-6 sm:py-6 md:col-span-6 md:py-6 lg:col-span-5 lg:py-7 lg:pl-8">
            <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-brand-orange-300">
              Everyday essentials
            </p>
            <h1
              id="home-hero-title"
              className="font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-[3rem]"
            >
              Your everyday{" "}
              <span className="text-brand-orange-300">value market</span>
            </h1>
            <p className="max-w-md text-xs sm:text-sm leading-relaxed text-white/80">
              Useful products, affordable prices, everyday convenience.
              Household, kitchen and cleaning essentials delivered to your door.
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
              <Link
                href="/shop"
                className="group inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-brand-orange px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-green"
              >
                Explore products
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/deals"
                className="inline-flex h-10 items-center whitespace-nowrap rounded-xl px-4 text-sm font-semibold text-white/90 ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Daily deals
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 pt-0.5 text-xs text-white/80">
              <li className="flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-brand-orange-300" aria-hidden />
                Free delivery above ₹199
              </li>
              <li className="flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-brand-orange-300" aria-hidden />
                Prices from ₹20
              </li>
            </ul>
          </div>

          <HeroShowcase products={products} />
        </div>
      </div>
    </section>
  );
}
