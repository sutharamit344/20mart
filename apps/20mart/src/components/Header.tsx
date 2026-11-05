'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo, Button } from '@20mart/ui';
import { useStore } from '../lib/store';
import {
  Search as SearchIcon,
  ShoppingBag,
  Heart,
  User,
  MapPin,
  ChevronDown,
  Menu,
  Sparkles,
  Percent,
  Flame,
  X,
  ArrowRight,
} from 'lucide-react';
import { mockCategories } from '@20mart/shared';

export const Header: React.FC = () => {
  const router = useRouter();
  const {
    cartCount,
    wishlist,
    user,
    selectedCity,
    setSelectedCity,
    searchQuery,
    setSearchQuery,
  } = useStore();

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [citySelectorOpen, setCitySelectorOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const cities = ['Ahmedabad', 'Gandhinagar', 'Vadodara', 'Surat', 'Rajkot'];

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white shadow-xs border-b border-gray-100">
        {/* Green Top Announcement Bar (Screen 01 Desktop Reference) */}
        <div className="hidden md:block bg-[#0B5D3B] text-white py-1.5 px-6 text-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-amber-300" />
                <span>Delivery to:</span>
                <button
                  type="button"
                  onClick={() => setCitySelectorOpen(!citySelectorOpen)}
                  className="font-bold text-amber-300 hover:underline cursor-pointer"
                >
                  {selectedCity}
                </button>
              </span>
              <span className="text-emerald-400">|</span>
              <span className="flex items-center gap-1 text-emerald-100">
                ⚡ Free delivery on orders above{' '}
                <span className="font-bold text-amber-300">₹199</span>
              </span>
            </div>
            <div className="flex items-center gap-4 text-emerald-100">
              <Link href="/about" className="hover:text-white transition-colors">
                Why 20Mart?
              </Link>
              <span className="text-emerald-600">|</span>
              <Link href="/contact" className="hover:text-white transition-colors">
                Help: +91 98765 43210
              </Link>
            </div>
          </div>
          {/* City selector dropdown inside top bar */}
          {citySelectorOpen && (
            <div className="absolute left-6 top-10 mt-1 w-44 rounded-2xl bg-white p-2 shadow-xl border border-gray-100 z-50 text-gray-800">
              <p className="text-[10px] uppercase font-bold text-gray-400 px-2 py-1">Select Delivery City</p>
              {cities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => { setSelectedCity(city); setCitySelectorOpen(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedCity === city ? 'bg-[#FFF6E9] text-[#FF7A00]' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Header Row (Screen 01 Desktop) */}
        <div className="py-2.5 sm:py-3 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-6">
            {/* Mobile Left: Hamburger Button */}
            <div className="flex items-center md:hidden">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="p-1.5 -ml-1 text-gray-700 hover:text-[#FF7A00] focus:outline-hidden cursor-pointer"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            {/* Logo */}
            <div className="flex-1 md:flex-initial flex justify-center md:justify-start">
              <Link href="/" className="shrink-0 flex items-center">
                <Logo size="md" showTagline={false} className="sm:hidden" />
                <Logo size="lg" showTagline={false} className="hidden sm:inline-flex" />
              </Link>
            </div>

            {/* Desktop Search Bar – Input + Search Button (matches Screen 01 desktop reference) */}
            <form
              onSubmit={handleSearchSubmit}
              className="hidden md:flex flex-1 max-w-2xl items-center gap-0"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for everyday products (e.g. peeler, storage, brush)..."
                className="flex-1 h-10 rounded-l-full border border-r-0 border-gray-300 bg-white py-2 pl-4 pr-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-[#FF7A00] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/20"
              />
              <button
                type="submit"
                className="h-10 px-5 rounded-r-full bg-[#FF7A00] flex items-center gap-1.5 text-white text-sm font-semibold hover:bg-[#E66E00] transition-colors cursor-pointer shrink-0"
              >
                <SearchIcon className="w-4 h-4" />
                <span>Search</span>
              </button>
            </form>

            {/* Right Action Items: Wishlist, Cart, Account */}
            <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
              {/* Wishlist Button (Screen 01) */}
              <Link
                href="/wishlist"
                className="relative hidden sm:flex items-center gap-1.5 p-2 pr-3 rounded-full hover:bg-gray-100 transition-colors text-gray-700 hover:text-[#FF7A00]"
                title="Wishlist"
              >
                <div className="relative">
                  <Heart className="w-5 h-5" />
                  {wishlist.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF7A00] text-[10px] font-bold text-white shadow-xs">
                      {wishlist.length}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold hidden lg:inline">Wishlist</span>
              </Link>

              {/* Shopping Cart Pill (Screen 01 Header) */}
              <Link
                href="/cart"
                className="relative flex items-center gap-1.5 rounded-full bg-[#FFF6E9] px-3 py-1.5 text-[#FF7A00] hover:bg-[#FFEED4] transition-colors shadow-xs"
              >
                <div className="relative">
                  <ShoppingBag className="w-5 h-5 text-[#FF7A00]" />
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-[#FF7A00] text-[10px] font-black text-white shadow-xs">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold hidden sm:inline">Cart</span>
              </Link>

              {/* User Account / Profile */}
              {user ? (
                <Link
                  href="/account"
                  className="flex items-center gap-2 rounded-full p-1 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B5D3B] text-white text-xs font-bold shadow-xs">
                    {user.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="hidden xl:flex flex-col text-left">
                    <span className="text-xs font-bold text-gray-800 leading-none">{user.name}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">My Account</span>
                  </div>
                </Link>
              ) : (
                <Link href="/auth" className="hidden md:inline-block">
                  <Button size="sm" variant="brand">
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Search Input */}
          <div className="mt-2.5 md:hidden">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for everyday products..."
                className="w-full h-9 rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-4 text-xs text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-hidden focus:border-[#FF7A00]"
              />
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </form>
          </div>
        </div>

        {/* Sub-nav / Category & Offer Links (Desktop Screen 01) */}
        <div className="hidden md:block bg-white border-t border-gray-100 px-6 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* "Shop By Category" Orange Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  className="flex items-center gap-2 rounded-xl bg-[#FF7A00] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#E66E00] transition-colors cursor-pointer"
                >
                  <Menu className="w-3.5 h-3.5" />
                  <span>Shop By Category</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {/* Category Dropdown Menu */}
                {categoryDropdownOpen && (
                  <div
                    onMouseLeave={() => setCategoryDropdownOpen(false)}
                    className="absolute left-0 top-full mt-2 w-64 rounded-2xl bg-white p-2.5 shadow-xl border border-gray-100 z-50 animate-in fade-in zoom-in-95"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 pb-1.5 border-b border-gray-100 mb-1">
                      All Categories
                    </p>
                    <div className="space-y-0.5">
                      {mockCategories.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/category/${cat.slug}`}
                          onClick={() => setCategoryDropdownOpen(false)}
                          className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-[#FFF6E9] hover:text-[#FF7A00] transition-colors"
                        >
                          <span>{cat.name}</span>
                          <span className="text-[10px] text-gray-400">{cat.itemCount}+</span>
                        </Link>
                      ))}
                    </div>
                    <div className="pt-2 mt-1 border-t border-gray-100">
                      <Link
                        href="/shop"
                        onClick={() => setCategoryDropdownOpen(false)}
                        className="block text-center text-xs font-bold text-[#0B5D3B] hover:underline py-1"
                      >
                        View All Products →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation links matching design reference Screen 01 */}
              <nav className="flex items-center gap-6 text-xs font-bold text-gray-700">
                <Link href="/" className="hover:text-[#FF7A00] transition-colors">
                  Home
                </Link>
                <Link href="/shop" className="hover:text-[#FF7A00] transition-colors">
                  Shop
                </Link>
                <Link
                  href="/coupons"
                  className="flex items-center gap-1 hover:text-[#FF7A00] transition-colors"
                >
                  <span>Offers</span>
                </Link>
                <Link
                  href="/shop?filter=daily-deals"
                  className="flex items-center gap-1 hover:text-[#FF7A00] transition-colors"
                >
                  <span>Daily Deals</span>
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
              <span className="text-[#0B5D3B] flex items-center gap-1 font-bold">
                ⚡ Free Delivery Above ₹199
              </span>
              <span className="text-gray-300">|</span>
              <Link
                href="/survey"
                className="text-[#FF7A00] hover:underline font-bold"
              >
                Get ₹50 Welcome Coupon →
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Menu */}
          <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col p-4 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <Logo size="sm" showTagline={false} />
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* City Selector (Mobile) */}
            <div className="p-2.5 rounded-xl bg-gray-50 text-xs">
              <span className="text-gray-400 block text-[10px]">Delivery City</span>
              <div className="font-bold text-gray-800 flex items-center justify-between mt-0.5">
                <span>{selectedCity}</span>
                <MapPin className="w-3.5 h-3.5 text-[#FF7A00]" />
              </div>
            </div>

            {/* Nav links */}
            <nav className="space-y-1 text-xs font-semibold text-gray-800 flex-1 overflow-y-auto">
              <Link
                href="/"
                onClick={() => setMobileDrawerOpen(false)}
                className="block px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF7A00]"
              >
                Home
              </Link>
              <Link
                href="/shop"
                onClick={() => setMobileDrawerOpen(false)}
                className="block px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF7A00]"
              >
                All Products
              </Link>
              <Link
                href="/category"
                onClick={() => setMobileDrawerOpen(false)}
                className="block px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF7A00]"
              >
                Categories
              </Link>
              <Link
                href="/coupons"
                onClick={() => setMobileDrawerOpen(false)}
                className="block px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF7A00]"
              >
                Coupons & Rewards
              </Link>
              <Link
                href="/early-access"
                onClick={() => setMobileDrawerOpen(false)}
                className="block px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF7A00]"
              >
                Early Access Campaign
              </Link>
              <Link
                href="/survey"
                onClick={() => setMobileDrawerOpen(false)}
                className="block px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF7A00]"
              >
                Product Survey (+₹50)
              </Link>
            </nav>

            <div className="pt-3 border-t border-gray-100 space-y-2">
              {user ? (
                <Link
                  href="/account"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 text-[#0B5D3B] text-xs font-bold"
                >
                  <User className="w-4 h-4" />
                  <span>My Account ({user.name})</span>
                </Link>
              ) : (
                <Link
                  href="/auth"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="block text-center w-full py-2.5 rounded-xl bg-[#0B5D3B] text-white text-xs font-bold"
                >
                  Sign In / Register
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
