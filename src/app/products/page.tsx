"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Upload, Package, AlertTriangle } from "lucide-react";

interface VariantRow {
  id?: string;
  color: string;
  size: string;
  stock: number;
}

interface ProductItem {
  id: string;
  name: string;
  sku?: string | null;
  imageUrl: string;
  costPrice: number;
  sellPrice: number;
  variants: VariantRow[];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [variants, setVariants] = useState<VariantRow[]>([
    { color: "أسود", size: "M", stock: 5 },
    { color: "أسود", size: "L", stock: 5 },
  ]);

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        setProducts(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function onUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !preset) {
      setNotice(
        "أضف NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME و NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET في .env"
      );
      return;
    }

    setUploading(true);
    setNotice("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", preset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();
      if (data.secure_url) {
        setImageUrl(data.secure_url);
      } else {
        setNotice("فشل رفع الصورة على Cloudinary");
      }
    } catch {
      setNotice("خطأ في الاتصال بـ Cloudinary");
    } finally {
      setUploading(false);
    }
  }

  function addVariant() {
    setVariants((prev) => [...prev, { color: "", size: "", stock: 1 }]);
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  function changeVariant(
    index: number,
    field: keyof VariantRow,
    value: string | number
  ) {
    setVariants((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  async function onSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    if (!imageUrl) {
      setNotice("ارفع صورة المنتج أولاً");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sku,
          imageUrl,
          costPrice: Number(costPrice),
          sellPrice: Number(sellPrice),
          variants,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "تعذر حفظ المنتج");
        setSaving(false);
        return;
      }

      setName("");
      setSku("");
      setImageUrl("");
      setCostPrice("");
      setSellPrice("");
      setVariants([{ color: "أسود", size: "M", stock: 5 }]);
      setNotice("تم حفظ المنتج والمخزن بنجاح");
      await loadProducts();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(product: ProductItem) {
    const ok = window.confirm(`هل تريد حذف المنتج "${product.name}"؟`);
    if (!ok) return;

    setNotice("");
    const res = await fetch(`/api/products/${product.id}`, {
      method: "DELETE",
    });
    const data = await res.json();

    if (!res.ok) {
      setNotice(data.error || "تعذر حذف المنتج");
      return;
    }

    setNotice("تم حذف المنتج بنجاح");
    await loadProducts();
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Package className="w-7 h-7 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-bold">المنتجات والمخزن</h1>
              <p className="text-sm text-slate-400">
                إضافة القطع بالصور والألوان والمقاسات والكميات
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href="/orders"
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
            >
              الأوردرات والحسابات
            </a>
            <a
              href="/orders/new"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              + أوردر جديد
            </a>
          </div>
        </div>

        {notice && (
          <div className="p-3 rounded-xl bg-slate-800 border border-emerald-500/40 text-emerald-300 text-sm">
            {notice}
          </div>
        )}

        <form
          onSubmit={onSaveProduct}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6"
        >
          <h2 className="text-lg font-bold">إضافة منتج جديد</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">اسم المنتج *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: بنطلون جينز وايد ليج"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">كود المنتج (اختياري)</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="JN-101"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">صورة المنتج *</label>
              <label className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 border border-dashed border-slate-600 rounded-xl px-3 py-2 text-sm cursor-pointer transition">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>
                  {uploading
                    ? "جاري الرفع..."
                    : imageUrl
                    ? "تم الرفع (تغيير)"
                    : "اختر صورة"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onUploadImage}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">سعر التكلفة (ج.م) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="300"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">سعر البيع (ج.م) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="550"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
              />
            </div>

            {imageUrl && (
              <div className="flex items-center gap-3">
                <img
                  src={imageUrl}
                  alt="معاينة"
                  className="w-16 h-16 object-cover rounded-xl border border-slate-700"
                />
                <span className="text-xs text-emerald-400">الصورة جاهزة</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">الألوان والمقاسات والكميات</label>
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> إضافة سطر
              </button>
            </div>

            <div className="space-y-2">
              {variants.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-3 sm:grid-cols-4 gap-2 items-center"
                >
                  <input
                    type="text"
                    placeholder="اللون (أزرق)"
                    value={row.color}
                    onChange={(e) => changeVariant(idx, "color", e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="المقاس (L)"
                    value={row.size}
                    onChange={(e) => changeVariant(idx, "size", e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="الكمية"
                    value={row.stock}
                    onChange={(e) =>
                      changeVariant(idx, "stock", Number(e.target.value))
                    }
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeVariant(idx)}
                    className="flex items-center justify-center text-red-400 hover:bg-red-500/10 p-2 rounded-xl cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || uploading}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition cursor-pointer"
          >
            {saving ? "جاري الحفظ..." : "حفظ المنتج"}
          </button>
        </form>

        <div className="space-y-4">
          <h2 className="text-lg font-bold">المخزن الحالي ({products.length})</h2>
          {loading ? (
            <p className="text-slate-400 text-sm">جاري التحميل...</p>
          ) : products.length === 0 ? (
            <p className="text-slate-400 text-sm">لا توجد منتجات مضافة بعد.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex gap-3">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-20 h-24 object-cover rounded-xl bg-slate-800 shrink-0"
                    />
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold truncate">{product.name}</h3>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(product)}
                          title="حذف المنتج"
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-xs text-slate-400">
                        التكلفة:{" "}
                        <span className="text-slate-200">{product.costPrice} ج.م</span> •
                        البيع:{" "}
                        <span className="text-emerald-400 font-semibold">
                          {product.sellPrice} ج.م
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-2 flex flex-wrap gap-1.5">
                    {product.variants.map((v, i) => {
                      const low = v.stock <= 2;
                      return (
                        <span
                          key={v.id || i}
                          className={`text-xs px-2 py-1 rounded-lg border flex items-center gap-1 ${
                            low
                              ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                              : "bg-slate-800 border-slate-700 text-slate-200"
                          }`}
                        >
                          {low && <AlertTriangle className="w-3 h-3" />}
                          {v.color} / {v.size}: <strong>{v.stock}</strong>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}