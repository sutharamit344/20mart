'use client';

import React, { useState } from 'react';
import { useAdmin } from '../../lib/admin-store';
import { Product, mockCategories } from '@20mart/shared';
import { Button, Modal } from '@20mart/ui';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export default function ProductsManagementPage() {
  const { products, addProduct, updateProduct, deleteProduct } = useAdmin();

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Kitchen & Home');
  const [price, setPrice] = useState(30);
  const [originalPrice, setOriginalPrice] = useState(40);
  const [stock, setStock] = useState(50);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(
    'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=400&q=80'
  );

  const openCreateModal = () => {
    setEditingProduct(null);
    setSku(`ZM-${Math.floor(100 + Math.random() * 900)}`);
    setName('');
    setCategory('Kitchen & Home');
    setPrice(25);
    setOriginalPrice(35);
    setStock(40);
    setDescription('Useful and durable daily item for every household.');
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setSku(p.sku);
    setName(p.name);
    setCategory(p.category);
    setPrice(p.price);
    setOriginalPrice(p.originalPrice);
    setStock(p.stock);
    setDescription(p.description);
    setImage(p.images[0] || '');
    setModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const discountPercent =
      originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

    const matchedCat = mockCategories.find((c) => c.name === category);

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        sku,
        name,
        category,
        categorySlug: matchedCat?.slug || 'kitchen-home',
        price,
        originalPrice,
        discountPercent,
        stock,
        inStock: stock > 0,
        description,
        images: [image],
      });
    } else {
      addProduct({
        sku,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description,
        category,
        categorySlug: matchedCat?.slug || 'kitchen-home',
        brand: '20Mart Value',
        price,
        originalPrice,
        discountPercent,
        rating: 5.0,
        reviewCount: 0,
        stock,
        inStock: stock > 0,
        images: [image],
        tags: [category.toLowerCase()],
      });
    }
    setModalOpen(false);
  };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCat === 'ALL' || p.category === selectedCat;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Products Catalog</h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage product listings, SKU variants, prices and inventory status.
          </p>
        </div>
        <Button
          size="md"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={openCreateModal}
          className="rounded-xl font-bold shadow-sm"
        >
          Add Product
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-xs text-gray-900 focus:bg-white focus:border-[#FF7A00] focus:outline-none"
          />
        </div>

        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none w-full sm:w-auto"
        >
          <option value="ALL">All Categories</option>
          {mockCategories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/60 uppercase font-semibold text-gray-500 text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">SKU</th>
                <th className="px-5 py-3.5">Price</th>
                <th className="px-5 py-3.5">Stock</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3 flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-gray-50 p-1 border border-gray-100 flex items-center justify-center">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <span className="font-bold text-gray-900 line-clamp-1">{product.name}</span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-gray-700">{product.category}</td>
                  <td className="px-5 py-3 font-mono text-[11px] text-gray-500">{product.sku}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-baseline gap-1">
                      <span className="font-bold text-gray-900">₹{product.price}</span>
                      {product.originalPrice > product.price && (
                        <span className="text-[10px] text-gray-400 line-through">
                          ₹{product.originalPrice}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-bold">
                    <span className={product.stock < 20 ? 'text-amber-600' : 'text-gray-900'}>
                      {product.stock} units
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {product.stock > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700">
                        <span>Out of Stock</span>
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(product)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProduct(product.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">SKU Code *</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full rounded-xl border border-gray-200 p-2.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-gray-200 p-2.5"
              >
                {mockCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Product Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stainless Steel Peeler"
              className="w-full rounded-xl border border-gray-200 p-2.5"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Selling Price (₹) *</label>
              <input
                type="number"
                required
                min={1}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 p-2.5"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Original Price (₹)</label>
              <input
                type="number"
                min={1}
                value={originalPrice}
                onChange={(e) => setOriginalPrice(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 p-2.5"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Stock Quantity *</label>
              <input
                type="number"
                required
                min={0}
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 p-2.5"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Image URL</label>
            <input
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5"
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
              Save Product
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

