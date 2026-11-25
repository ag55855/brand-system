"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Check, Plus, Trash2, Send, UserCheck, ShoppingBag, Search } from "lucide-react";

interface VariantOpt {
  id: string;
  color: string;
  size: string;
  stock: number;
}

interface ProductOpt {
  id: string;
  name: string;
  sellPrice: number;
  costPrice: number;
  variants: VariantOpt[];
}

interface GovOpt {
  id: string;
  name: string;
  shippingFee: number;
}

interface FoundCustomer {
  id: string;
  name: string;
  phone: string;
  altPhone?: string | null;
  governorateId: string;
  area: string;
  address: string;
  landmark?: string | null;
  notes?: string | null;
  orders?: { id: string }[];
}

interface OrderLine {
  productVariantId: string;
  qty: number;
}

function toWhatsappPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("01") && digits.length === 11) {
    return `2${digits}`;
  }
  return digits;
}

export default function NewOrderPage() {
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [governorates, setGovernorates] = useState<GovOpt[]>([]);
  const [suggestions, setSuggestions] = useState<FoundCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<FoundCustomer | null>(null);
  const [quickSearch, setQuickSearch] = useState("");

  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [name, setName] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [shippingOverride, setShippingOverride] = useState("");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<OrderLine[]>([{ productVariantId: "", qty: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [targetPhone, setTargetPhone] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadInit() {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setGovernorates(data.governorates || []);
        if (data.governorates?.length) {
          setGovernorateId(data.governorates[0].id);
          setShippingOverride(String(data.governorates[0].shippingFee));
        }
      }
    }
    loadInit();
  }, []);

  useEffect(() => {
    const q = quickSearch.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/orders?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.customers || []);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [quickSearch]);

  function fillCustomer(c: FoundCustomer) {
    setSelectedCustomer(c);
    setPhone(c.phone);
    setAltPhone(c.altPhone || "");
    setName(c.name);
    setGovernorateId(c.governorateId);
    const gov = governorates.find((g) => g.id === c.governorateId);
    if (gov) setShippingOverride(String(gov.shippingFee));
    setArea(c.area);
    setAddress(c.address);
    setLandmark(c.landmark || "");
    setCustomerNotes(c.notes || "");
    setSuggestions([]);
    setQuickSearch("");
  }

  function handleGovChange(newGovId: string) {
    setGovernorateId(newGovId);
    const gov = governorates.find((g) => g.id === newGovId);
    if (gov) {
      setShippingOverride(String(gov.shippingFee));
    }
  }

  const variantOptions = useMemo(() => {
    const list: {
      id: string;
      label: string;
      sellPrice: number;
      costPrice: number;
    }[] = [];
    for (const p of products) {
      for (const v of p.variants) {
        list.push({
          id: v.id,
          label: `${p.name} — ${v.color} / ${v.size} (متاح: ${v.stock})`,
          sellPrice: p.sellPrice,
          costPrice: p.costPrice,
        });
      }
    }
    return list;
  }, [products]);

  const activeShipping = Math.max(0, Number(shippingOverride) || 0);

  const totals = useMemo(() => {
    let itemsTotal = 0;
    let totalCost = 0;
    for (const l of lines) {
      if (!l.productVariantId) continue;
      const found = variantOptions.find((o) => o.id === l.productVariantId);
      if (!found) continue;
      const qty = Math.max(1, Number(l.qty) || 1);
      itemsTotal += found.sellPrice * qty;
      totalCost += found.costPrice * qty;
    }
    const disc = Math.max(0, Number(discount) || 0);
    const grandTotal = Math.max(0, itemsTotal - disc + activeShipping);
    const estProfit = itemsTotal - disc - totalCost;
    return { itemsTotal, totalCost, grandTotal, estProfit };
  }, [lines, variantOptions, discount, activeShipping]);

  function addLine() {
    setLines((prev) => [...prev, { productVariantId: "", qty: 1 }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof OrderLine, val: string | number) {
    setLines((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOrderMessage("");
    setCopied(false);

    const chosen = lines.filter((l) => l.productVariantId);
    if (chosen.length === 0) {
      setError("اختر منتج ومقاس واحد على الأقل");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          altPhone,
          governorateId,
          area,
          address,
          landmark,
          customerNotes,
          customShippingFee: activeShipping,
          discount: Number(discount) || 0,
          notes,
          items: chosen,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذر حفظ الأوردر");
        setSubmitting(false);
        return;
      }

      const linesText = (data.items || [])
        .map(
          (it: {
            qty: number;
            unitPrice: number;
            productVariant: { color: string; size: string; product: { name: string } };
          }) =>
            `▫️ ${it.productVariant.product.name} (${it.productVariant.color} - مقاس ${it.productVariant.size}) × ${it.qty} = ${it.unitPrice * it.qty} ج.م`
        )
        .join("\n");

      const text = [
        `أهلاً بكِ يا *${data.customer.name}* في *HerERA* ✨`,
        `تم تسجيل طلبك بنجاح وتفاصيله كالتالي:`,
        ``,
        `🧾 *رقم الأوردر:* #${data.orderNo}`,
        `🛍️ *القطع:*`,
        linesText,
        ``,
        `💵 *سعر القطع:* ${data.itemsTotal} ج.م`,
        data.discount > 0 ? `🎁 *الخصم:* -${data.discount} ج.م` : null,
        `🚚 *الشحن (${data.governorate.name}):* ${data.shippingFee === 0 ? "مجاني" : `${data.shippingFee} ج.م`}`,
        `💰 *الإجمالي عند الاستلام:* *${data.grandTotal} ج.م*`,
        ``,
        `📍 *عنوان التوصيل:* ${data.fullAddress}`,
        `📞 *رقم التواصل:* ${data.customer.phone}`,
        ``,
        `يرجى الرد بكلمة *(تأكيد)* لبدء تجهيز وشحن أوردرك في أسرع وقت 🤍`,
      ]
        .filter((line) => line !== null)
        .join("\n");

      setOrderMessage(text);
      setTargetPhone(data.customer.phone);

      setPhone("");
      setAltPhone("");
      setName("");
      setArea("");
      setAddress("");
      setLandmark("");
      setCustomerNotes("");
      setDiscount("0");
      setNotes("");
      setSelectedCustomer(null);
      setLines([{ productVariantId: "", qty: 1 }]);

      const refresh = await fetch("/api/orders");
      if (refresh.ok) {
        const refreshedData = await refresh.json();
        setProducts(refreshedData.products || []);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function copyMsg() {
    if (!orderMessage) return;
    await navigator.clipboard.writeText(orderMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const waUrl = orderMessage
    ? `https://wa.me/${toWhatsappPhone(targetPhone)}?text=${encodeURIComponent(orderMessage)}`
    : "#";

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-7 h-7 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-bold">تسجيل عميلة وأوردر جديد</h1>
              <p className="text-sm text-slate-400">حفظ العميلة + خصم المخزن + رسالة واتساب جاهزة</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href="/products"
              className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition"
            >
              المنتجات والمخزن
            </a>
            <a
              href="/orders"
              className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              الأوردرات والحسابات
            </a>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-sm">
            {error}
          </div>
        )}

        {orderMessage && (
          <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-emerald-300">
                تم تسجيل الأوردر وحفظ العميلة — ابعت الرسالة على واتساب:
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyMsg}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? "تم النسخ" : "نسخ الرسالة"}
                </button>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                >
                  <Send className="w-4 h-4" /> إرسال واتساب مباشرة
                </a>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-slate-100 bg-slate-900/80 p-3 rounded-xl font-sans leading-relaxed">
              {orderMessage}
            </pre>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">1. بيانات العميلة والعنوان</h2>
              {selectedCustomer && (
                <span className="flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full">
                  <UserCheck className="w-3.5 h-3.5" /> عميلة سابقة ({selectedCustomer.orders?.length || 0} طلبات)
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="بحث سريع عن عميلة سابقة بالاسم أو رقم الموبايل لملء بياناتها تلقائياً..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pr-10 pl-3 py-2 text-sm"
              />
              {suggestions.length > 0 && (
                <div className="mt-1 bg-slate-800 border border-slate-700 rounded-xl divide-y divide-slate-700 overflow-hidden">
                  {suggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => fillCustomer(c)}
                      className="w-full text-right px-3 py-2 text-xs hover:bg-slate-700 flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-semibold text-emerald-300">{c.name}</span>
                      <span className="text-slate-300">{c.phone} — {c.area}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">رقم الموبايل الأساسي *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010xxxxxxxx"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">اسم العميلة *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="الاسم بالكامل"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">رقم احتياطي</label>
                <input
                  type="text"
                  value={altPhone}
                  onChange={(e) => setAltPhone(e.target.value)}
                  placeholder="اختياري"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">المحافظة *</label>
                <select
                  value={governorateId}
                  onChange={(e) => handleGovChange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                >
                  {governorates.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} (الافتراضي {g.shippingFee} ج.م)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">المنطقة / المدينة *</label>
                <input
                  type="text"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="مثال: التجمع الخامس / المعادي"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">أقرب علامة مميزة</label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="بجوار..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">العنوان بالتفصيل (الشارع / العمارة / الدور / الشقة) *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="اكتب العنوان التفصيلي للتسليم"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">ملاحظات عن العميلة</label>
                <input
                  type="text"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="مقاسها المعتاد أو مواعيد الاستلام"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">2. قطع الأوردر والشحن</h2>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> إضافة قطعة
              </button>
            </div>

            <div className="space-y-2.5">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <select
                    value={line.productVariantId}
                    onChange={(e) => updateLine(idx, "productVariantId", e.target.value)}
                    className="sm:col-span-8 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">اختر المنتج واللون والمقاس...</option>
                    {variantOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label} — {opt.sellPrice} ج.م
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={line.qty}
                    onChange={(e) => updateLine(idx, "qty", Math.max(1, Number(e.target.value) || 1))}
                    className="sm:col-span-3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="sm:col-span-1 flex items-center justify-center text-red-400 hover:bg-red-500/10 p-2 rounded-xl cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">مصاريف الشحن (0 للشحن المجاني)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingOverride}
                  onChange={(e) => setShippingOverride(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">خصم (ج.م)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">ملاحظات الأوردر</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات للتجهيز أو الشحن"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 text-sm">
              <div>المنتجات: <strong>{totals.itemsTotal} ج.م</strong></div>
              <div>الشحن: <strong>{activeShipping} ج.م</strong></div>
              <div>الخصم: <strong className="text-amber-400">{Math.max(0, Number(discount) || 0)} ج.م</strong></div>
              <div className="text-base pt-1">
                الإجمالي المطلوب: <strong className="text-emerald-400 text-lg">{totals.grandTotal} ج.م</strong>
              </div>
              <div className="text-xs text-slate-400">
                ربح تقديري قبل مصاريف التشغيل: {totals.estProfit} ج.م (التكلفة: {totals.totalCost} ج.م)
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl transition cursor-pointer"
            >
              {submitting ? "جاري الحفظ..." : "تسجيل العميلة والأوردر وتوليد الرسالة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}