import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

const VALID_STATUSES: OrderStatus[] = [
  "NEW",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
];

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { status } = await req.json();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) {
        throw new Error("الأوردر غير موجود");
      }

      const wasReserved = order.status !== "RETURNED" && order.status !== "CANCELLED";
      const willRelease = status === "RETURNED" || status === "CANCELLED";

      if (wasReserved && willRelease) {
        for (const item of order.items) {
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { increment: item.qty } },
          });
        }
      } else if (!wasReserved && !willRelease) {
        for (const item of order.items) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.productVariantId },
          });
          if (!variant || variant.stock < item.qty) {
            throw new Error("الرصيد غير كافٍ لإعادة تفعيل الأوردر");
          }
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { decrement: item.qty } },
          });
        }
      }

      return await tx.order.update({
        where: { id },
        data: { status },
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

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "فشل تحديث الحالة";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!order) {
        throw new Error("الأوردر غير موجود");
      }

      const shouldRestoreStock =
        order.status !== "RETURNED" && order.status !== "CANCELLED";

      if (shouldRestoreStock) {
        for (const item of order.items) {
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { increment: item.qty } },
          });
        }
      }

      await tx.order.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "تعذر حذف الأوردر";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}