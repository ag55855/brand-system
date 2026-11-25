import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const GOVERNORATES_SEED = [
  { name: "القاهرة", shippingFee: 60 },
  { name: "الجيزة", shippingFee: 60 },
  { name: "الإسكندرية", shippingFee: 75 },
  { name: "القليوبية", shippingFee: 70 },
  { name: "الدقهلية", shippingFee: 80 },
  { name: "الشرقية", shippingFee: 80 },
  { name: "الغربية", shippingFee: 80 },
  { name: "المنوفية", shippingFee: 80 },
  { name: "البحيرة", shippingFee: 85 },
  { name: "دمياط", shippingFee: 85 },
  { name: "بورسعيد", shippingFee: 85 },
  { name: "الإسماعيلية", shippingFee: 85 },
  { name: "السويس", shippingFee: 85 },
  { name: "الفيوم", shippingFee: 90 },
  { name: "بني سويف", shippingFee: 90 },
  { name: "المنيا", shippingFee: 95 },
  { name: "أسيوط", shippingFee: 100 },
  { name: "سوهاج", shippingFee: 100 },
  { name: "قنا", shippingFee: 110 },
  { name: "الأقصر", shippingFee: 110 },
  { name: "أسوان", shippingFee: 120 },
  { name: "البحر الأحمر", shippingFee: 120 },
  { name: "مطروح", shippingFee: 120 },
];

async function getGovernoratesList() {
  const existing = await prisma.governorate.count();
  if (existing === 0) {
    await prisma.governorate.createMany({
      data: GOVERNORATES_SEED,
      skipDuplicates: true,
    });
  }
  return await prisma.governorate.findMany({
    orderBy: { name: "asc" },
  });
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const governorates = await getGovernoratesList();

    if (q) {
      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { phone: { contains: q } },
            { altPhone: { contains: q } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
        include: {
          governorate: true,
          orders: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        take: 6,
      });
      return NextResponse.json({ customers, governorates });
    }

    const [orders, products] = await Promise.all([
      prisma.order.findMany({
        include: {
          customer: true,
          governorate: true,
          items: {
            include: {
              productVariant: {
                include: { product: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.findMany({
        include: {
          variants: {
            where: { stock: { gt: 0 } },
            orderBy: [{ color: "asc" }, { size: "asc" }],
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({ orders, products, governorates });
  } catch {
    return NextResponse.json({ error: "فشل تحميل البيانات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      phone,
      altPhone,
      governorateId,
      area,
      address,
      landmark,
      customerNotes,
      customShippingFee,
      discount = 0,
      notes,
      items,
    } = body;

    if (
      !name ||
      !phone ||
      !governorateId ||
      !area ||
      !address ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        { error: "أكمل بيانات العميل والعنوان واختر منتج واحد على الأقل" },
        { status: 400 }
      );
    }

    const cleanPhone = String(phone).trim();
    const cleanDiscount = Math.max(0, Number(discount) || 0);

    const order = await prisma.$transaction(async (tx) => {
      const gov = await tx.governorate.findUnique({ where: { id: governorateId } });
      if (!gov) {
        throw new Error("المحافظة غير موجودة");
      }

      let itemsTotal = 0;
      let totalCost = 0;

      const orderItemsData: {
        productVariantId: string;
        qty: number;
        unitPrice: number;
        unitCost: number;
      }[] = [];

      for (const raw of items) {
        const variantId = String(raw.productVariantId);
        const qty = Math.max(1, Number(raw.qty) || 1);

        const variant = await tx.productVariant.findUnique({
          where: { id: variantId },
          include: { product: true },
        });

        if (!variant) {
          throw new Error("أحد المقاسات غير موجود");
        }

        if (variant.stock < qty) {
          throw new Error(
            `الكمية غير كافية لـ ${variant.product.name} (${variant.color} / ${variant.size}) - المتاح: ${variant.stock}`
          );
        }

        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock: { decrement: qty } },
        });

        const unitPrice = Number(variant.product.sellPrice);
        const unitCost = Number(variant.product.costPrice);

        itemsTotal += unitPrice * qty;
        totalCost += unitCost * qty;

        orderItemsData.push({
          productVariantId: variant.id,
          qty,
          unitPrice,
          unitCost,
        });
      }

      const shippingFee =
        customShippingFee !== undefined && customShippingFee !== ""
          ? Math.max(0, Number(customShippingFee) || 0)
          : Number(gov.shippingFee);

      const grandTotal = Math.max(0, itemsTotal - cleanDiscount + shippingFee);

      const fullAddress = `${area.trim()} - ${address.trim()}${
        landmark?.trim() ? ` (علامة مميزة: ${landmark.trim()})` : ""
      }`;

      const customer = await tx.customer.upsert({
        where: { phone: cleanPhone },
        update: {
          name: String(name).trim(),
          altPhone: altPhone?.trim() ? String(altPhone).trim() : null,
          governorateId: gov.id,
          area: String(area).trim(),
          address: String(address).trim(),
          landmark: landmark?.trim() ? String(landmark).trim() : null,
          notes: customerNotes?.trim() ? String(customerNotes).trim() : undefined,
        },
        create: {
          name: String(name).trim(),
          phone: cleanPhone,
          altPhone: altPhone?.trim() ? String(altPhone).trim() : null,
          governorateId: gov.id,
          area: String(area).trim(),
          address: String(address).trim(),
          landmark: landmark?.trim() ? String(landmark).trim() : null,
          notes: customerNotes?.trim() ? String(customerNotes).trim() : null,
        },
      });

      return await tx.order.create({
        data: {
          customerId: customer.id,
          governorateId: gov.id,
          fullAddress,
          itemsTotal,
          discount: cleanDiscount,
          shippingFee,
          grandTotal,
          totalCost,
          notes: notes?.trim() ? String(notes).trim() : null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          customer: true,
          governorate: true,
          items: {
            include: {
              productVariant: { include: { product: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "تعذر تسجيل الأوردر";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}