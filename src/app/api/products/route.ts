import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        variants: {
          orderBy: [{ color: "asc" }, { size: "asc" }],
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(products);
  } catch {
    return NextResponse.json({ error: "فشل جلب المنتجات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, sku, imageUrl, costPrice, sellPrice, variants } = body;

    if (!name || !imageUrl || costPrice === undefined || sellPrice === undefined) {
      return NextResponse.json(
        { error: "اسم المنتج، الصورة، سعر التكلفة، وسعر البيع مطلوبين" },
        { status: 400 }
      );
    }

    const cleanVariants = Array.isArray(variants)
      ? variants
          .filter((v) => v?.color?.trim() && v?.size?.trim())
          .map((v) => ({
            color: String(v.color).trim(),
            size: String(v.size).trim(),
            stock: Math.max(0, Number(v.stock) || 0),
          }))
      : [];

    const created = await prisma.product.create({
      data: {
        name: String(name).trim(),
        sku: sku?.trim() ? String(sku).trim() : null,
        imageUrl: String(imageUrl).trim(),
        costPrice: Number(costPrice),
        sellPrice: Number(sellPrice),
        variants: {
          create: cleanVariants,
        },
      },
      include: { variants: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const msg =
      err instanceof Error && err.message.includes("Unique constraint")
        ? "كود المنتج (SKU) مستخدم من قبل"
        : "تعذر حفظ المنتج";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}