'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo, Button, cn } from '@20mart/ui';
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
  TrendingUp,
  Tag,
} from 'lucide-react';
import { mockCategories, mockProducts } from '@20mart/shared';

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

  const [citySelectorOpen, setCitySelectorOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [desktopSuggestionsOpen, setDesktopSuggestionsOpen] = useState(false);
  const [mobileSuggestionsOpen, setMobileSuggestionsOpen] = useState(false);

  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  const popularSearches = [
    'Kitchen Peeler',
    'Storage Basket',
    'Bag Clips',
    'Cleaning Brush',
    'Storage Container',
    'Spatula Set',
  ];

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return mockProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.subcategory?.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [searchQuery]);

  const executeSearch = (query: string) => {
    const q = query.trim();
    if (!q) return;
    setSearchQuery(q);
    setIsSearchOpen(false);
    setDesktopSuggestionsOpen(false);
    setMobileSuggestionsOpen(false);
    router.push(`/shop?q=${encodeURIComponent(q)}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        desktopSearchRef.current &&
        !desktopSearchRef.current.contains(e.target as Node)
      ) {
        setDesktopSuggestionsOpen(false);
      }
      if (
        mobileSearchRef.current &&
        !mobileSearchRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
        setMobileSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderSuggestions = (onSelect: (q: string) => void) => (
    <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-white border border-gray-200/90 shadow-2xl overflow-hidden divide-y divide-gray-100 animate-in fade-in slide-in-from-top-1 duration-150">
      {searchQuery.trim().length > 0 ? (
        <div className="p-3 space-y-2">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
            Matching Products
          </div>
          {searchResults.length > 0 ? (
            <div className="space-y-1">
              {searchResults.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                    setDesktopSuggestionsOpen(false);
                    setMobileSuggestionsOpen(false);
                    router.push(`/product/${prod.slug}`);
                  }}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-[#FFF6E9]/60 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={prod.images[0]}
                      alt={prod.name}
                      className="w-10 h-10 rounded-lg object-cover bg-gray-50 shrink-0 border border-gray-100"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 group-hover:text-[#FF7A00] truncate transition-colors">
                        {prod.name}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {prod.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <span className="text-xs font-black text-gray-900">
                      ₹{prod.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-gray-500">
              No matching products found
            </div>
          )}

          <button
            type="button"
            onClick={() => onSelect(searchQuery)}
            className="w-full mt-1 py-2 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF7A00] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <SearchIcon className="w-3.5 h-3.5" />
            <span>Search all for "{searchQuery}"</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="p-3.5 space-y-3.5">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>Popular Searches</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {popularSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => onSelect(term)}
                  className="px-2.5 py-1 rounded-full bg-gray-50 hover:bg-[#FFF6E9] hover:text-[#FF7A00] text-gray-700 text-xs font-semibold border border-gray-200/80 transition-colors cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              <Tag className="w-3.5 h-3.5 text-[#0B5D3B]" />
              <span>Categories</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {mockCategories.slice(0, 4).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(false);
                    setDesktopSuggestionsOpen(false);
                    setMobileSuggestionsOpen(false);
                    router.push(`/category/${cat.slug}`);
                  }}
                  className="flex items-center gap-2 p-2 rounded-xl bg-gray-50/80 hover:bg-emerald-50/60 text-left transition-colors cursor-pointer group"
                >
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-5 h-5 rounded-md object-cover bg-white"
                  />
                  <span className="text-xs font-bold text-gray-800 group-hover:text-[#0B5D3B] truncate">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const cities = ['Ahmedabad', 'Gandhinagar', 'Vadodara', 'Surat', 'Rajkot'];

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white shadow-xs border-b border-gray-100">
        {/* Green Top Announcement Bar (Screen 01 Desktop Reference) */}
        <div className="hidden md:block bg-[#0B5D3B] text-white py-1 text-[11px] leading-tight">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 relative">
                <MapPin className="w-3 h-3 text-amber-300" />
                <span>Delivery to:</span>
                <button
                  type="button"
                  onClick={() => setCitySelectorOpen(!citySelectorOpen)}
                  className="font-bold text-amber-300 hover:underline cursor-pointer"
                >
                  {selectedCity}
                </button>
                {/* City selector dropdown */}
                {citySelectorOpen && (
                  <div className="absolute left-0 top-full mt-2 w-44 rounded-2xl bg-white p-2 shadow-xl border border-gray-100 z-50 text-gray-800">
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
        </div>

        {/* Main Header Row */}
        <div className="py-2 sm:py-2.5 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between gap-3 sm:gap-6">
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
              <div className="flex-1 md:flex-initial flex justify-center md:justify-start shrink-0">
                <Link href="/" className="shrink-0 flex items-center">
                  <Logo size="sm" showTagline={false} className="sm:hidden" />
                  <Logo size="md" showTagline={false} className="hidden sm:inline-flex" />
                </Link>
              </div>

              {/* Desktop Nav Links (placed between Logo and Search Bar) */}
              <nav className="hidden md:flex items-center gap-3.5 lg:gap-5 text-xs font-bold text-gray-700 shrink-0">
                <Link href="/" className="hover:text-[#FF7A00] transition-colors py-1">
                  Home
                </Link>
                <Link href="/shop" className="hover:text-[#FF7A00] transition-colors py-1">
                  Shop
                </Link>
                <Link
                  href="/coupons"
                  className="hover:text-[#FF7A00] transition-colors py-1"
                >
                  Offers
                </Link>
                <Link
                  href="/shop?filter=daily-deals"
                  className="hover:text-[#FF7A00] transition-colors py-1 whitespace-nowrap"
                >
                  Daily Deals
                </Link>
              </nav>

              {/* Desktop Search Bar – Input + Search Button + Suggestions Dropdown */}
              <div ref={desktopSearchRef} className="hidden md:block flex-1 max-w-md lg:max-w-xl relative">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex items-center gap-0 w-full"
                >
                  <input
                    type="text"
                    value={searchQuery}
                    onFocus={() => setDesktopSuggestionsOpen(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setDesktopSuggestionsOpen(true);
                    }}
                    placeholder="Search for everyday products (e.g. peeler, storage, brush)..."
                    className="flex-1 h-9 rounded-l-full border border-r-0 border-gray-300 bg-white py-1.5 pl-4 pr-3 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-[#FF7A00] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/20"
                  />
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-r-full bg-[#FF7A00] flex items-center gap-1.5 text-white text-xs font-semibold hover:bg-[#E66E00] transition-colors cursor-pointer shrink-0"
                  >
                    <SearchIcon className="w-3.5 h-3.5" />
                    <span>Search</span>
                  </button>
                </form>

                {desktopSuggestionsOpen && renderSuggestions(executeSearch)}
              </div>

              {/* Right Action Items: Wishlist, Cart, Account */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                {/* Wishlist Icon Button – visible in logo bar on both mobile & desktop */}
                <Link
                  href="/wishlist"
                  className="relative flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100 transition-colors text-gray-700 hover:text-[#FF7A00]"
                  title="Wishlist"
                  aria-label="Wishlist"
                >
                  <Heart className="w-5 h-5" />
                  {wishlist.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#FF7A00] text-[10px] font-bold text-white shadow-xs leading-none">
                      {wishlist.length}
                    </span>
                  )}
                </Link>

                {/* Shopping Cart Icon Button – visible in logo bar on both mobile & desktop */}
                <Link
                  href="/cart"
                  className="relative flex items-center justify-center h-9 w-9 rounded-full bg-[#FFF6E9] text-[#FF7A00] hover:bg-[#FFEED4] transition-colors border border-orange-200/50 shadow-2xs"
                  title="Cart"
                  aria-label="Cart"
                >
                  <ShoppingBag className="w-5 h-5 text-[#FF7A00]" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#FF7A00] text-[10px] font-black text-white shadow-xs leading-none">
                      {cartCount}
                    </span>
                  )}
                </Link>

                {/* User Account / Profile – hidden on mobile (handled by bottom nav), visible on desktop */}
                {user ? (
                  <Link
                    href="/account"
                    className="hidden md:flex items-center gap-2 rounded-full p-0.5 hover:bg-gray-100 transition-colors"
                    title={user.name}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B5D3B] text-white text-xs font-bold shadow-xs select-none">
                      {user.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div className="hidden xl:flex flex-col text-left pr-2">
                      <span className="text-xs font-bold text-gray-800 leading-tight">{user.name}</span>
                      <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">My Account</span>
                    </div>
                  </Link>
                ) : (
                  <Link href="/auth" className="hidden md:inline-block">
                    <Button size="sm" variant="brand" className="h-9 px-3.5 text-xs">
                      Sign In
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Mobile Full-Width Search Row */}
            <div ref={mobileSearchRef} className="mt-2 md:hidden relative">
              <form
                onSubmit={handleSearchSubmit}
                className="relative flex items-center w-full"
              >
                <SearchIcon className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => {
                    setIsSearchOpen(true);
                    setMobileSuggestionsOpen(true);
                  }}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setMobileSuggestionsOpen(true);
                  }}
                  placeholder="Search for everyday products..."
                  className={cn(
                    'w-full h-9 rounded-full border border-gray-200 bg-gray-50/90 py-1.5 pl-9 text-xs text-gray-900 placeholder:text-gray-400 transition-all focus:bg-white focus:outline-none focus:border-[#FF7A00]',
                    isSearchOpen ? 'pr-20 ring-2 ring-[#FF7A00]/20' : 'pr-3'
                  )}
                />

                {/* On click / active search: show Search icon button + Clear icon */}
                {isSearchOpen && (
                  <div className="absolute right-1 flex items-center gap-1">
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="submit"
                      className="h-7 px-2.5 rounded-full bg-[#FF7A00] hover:bg-[#E66E00] text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <SearchIcon className="w-3 h-3" />
                      <span>Search</span>
                    </button>
                  </div>
                )}
              </form>

              {/* Mobile Search Suggestions Dropdown */}
              {isSearchOpen && mobileSuggestionsOpen && renderSuggestions(executeSearch)}
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
