"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Plus, Search, Trash2, Send } from "lucide-react";

type OrderStatus = "NEW" | "PREPARING" | "SHIPPED" | "DELIVERED" | "RETURNED" | "CANCELLED";

interface OrderItemView {
  id: string;
  qty: number;
  unitPrice: number;
  productVariant: {
    color: string;
    size: string;
    product: { name: string };
  };
}

interface OrderView {
  id: string;
  orderNo: number;
  fullAddress: string;
  status: OrderStatus;
  itemsTotal: number;
  discount: number;
  shippingFee: number;
  grandTotal: number;
  totalCost: number;
  customer: {
    name: string;
    phone: string;
  };
  governorate: {
    name: string;
  };
  items: OrderItemView[];
}

const STATUS_AR: Record<OrderStatus, string> = {
  NEW: "جديد",
  PREPARING: "قيد التجهيز",
  SHIPPED: "تم الشحن",
  DELIVERED: "تم التسليم",
  RETURNED: "مرتجع",
  CANCELLED: "ملغي",
};

function toWhatsappPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("01") && digits.length === 11) {
    return `2${digits}`;
  }
  return digits;
}

function buildOrderWaLink(order: OrderView) {
  const linesText = order.items
    .map(
      (it) =>
        `▫️ ${it.productVariant.product.name} (${it.productVariant.color} - مقاس ${it.productVariant.size}) × ${it.qty} = ${it.unitPrice * it.qty} ج.م`
    )
    .join("\n");

  const text = [
    `أهلاً بكِ يا *${order.customer.name}* في *HerERA* ✨`,
    `تفاصيل أوردرك رقم *#${order.orderNo}*:`,
    linesText,
    order.discount > 0 ? `🎁 *الخصم:* -${order.discount} ج.م` : null,
    `🚚 *الشحن (${order.governorate.name}):* ${order.shippingFee === 0 ? "مجاني" : `${order.shippingFee} ج.م`}`,
    `💰 *الإجمالي عند الاستلام:* *${order.grandTotal} ج.م*`,
    `📍 *العنوان:* ${order.fullAddress}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/${toWhatsappPhone(order.customer.phone)}?text=${encodeURIComponent(text)}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  async function fetchOrders() {
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  async function onStatusChange(id: string, status: OrderStatus) {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await fetchOrders();
    }
  }

  async function onDeleteOrder(order: OrderView) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف الأوردر #${order.orderNo} للعميلة ${order.customer.name}؟ سيتم إرجاع القطع للمخزن تلقائياً.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/orders/${order.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await fetchOrders();
    }
  }

  const summary = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "DELIVERED");
    const deliveredSales = delivered.reduce((sum, o) => sum + o.itemsTotal - o.discount, 0);
    const deliveredCost = delivered.reduce((sum, o) => sum + o.totalCost, 0);
    const netProfit = deliveredSales - deliveredCost;
    return {
      total: orders.length,
      deliveredCount: delivered.length,
      deliveredSales,
      netProfit,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        String(o.orderNo).includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.phone.toLowerCase().includes(q)
      );
    });
  }, [orders, query, statusFilter]);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-bold">الأوردرات والحسابات</h1>
              <p className="text-sm text-slate-400">متابعة التجهيز والتسليم وصافي الربح الفعلي</p>
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
              href="/orders/new"
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" /> أوردر جديد
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400">إجمالي الأوردرات</div>
            <div className="text-2xl font-bold mt-1">{summary.total}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400">تم تسليمها</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{summary.deliveredCount}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400">مبيعات المسلم (بدون شحن)</div>
            <div className="text-2xl font-bold mt-1">{summary.deliveredSales} ج.م</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400">صافي ربح المسلم</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{summary.netProfit} ج.م</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث برقم الأوردر، اسم العميلة، أو الموبايل..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-3 py-2 text-sm"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm"
          >
            <option value="ALL">كل الحالات</option>
            {(Object.keys(STATUS_AR) as OrderStatus[]).map((st) => (
              <option key={st} value={st}>
                {STATUS_AR[st]}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm">جاري التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-400 text-sm">لا توجد أوردرات.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <div
                key={order.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-emerald-400">#{order.orderNo}</span>
                    <span className="font-semibold">{order.customer.name}</span>
                    <span className="text-xs text-slate-400" dir="ltr">
                      {order.customer.phone}
                    </span>
                    <span className="text-xs bg-slate-800 px-2 py-0.5 rounded">
                      {order.governorate.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold ml-2">{order.grandTotal} ج.م</span>
                    <select
                      value={order.status}
                      onChange={(e) => onStatusChange(order.id, e.target.value as OrderStatus)}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs"
                    >
                      {(Object.keys(STATUS_AR) as OrderStatus[]).map((st) => (
                        <option key={st} value={st}>
                          {STATUS_AR[st]}
                        </option>
                      ))}
                    </select>
                    <a
                      href={buildOrderWaLink(order)}
                      target="_blank"
                      rel="noreferrer"
                      title="إرسال واتساب"
                      className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
                    >
                      <Send className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onDeleteOrder(order)}
                      title="حذف الأوردر"
                      className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-400">العنوان: {order.fullAddress}</div>

                <div className="flex flex-wrap gap-2">
                  {order.items.map((item) => (
                    <span
                      key={item.id}
                      className="text-xs bg-slate-800/90 border border-slate-700/70 px-2.5 py-1 rounded-lg"
                    >
                      {item.productVariant.product.name} ({item.productVariant.color} /{" "}
                      {item.productVariant.size}) × {item.qty}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}