import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const linkedOrderItems = await prisma.orderItem.count({
      where: {
        productVariant: {
          productId: id,
        },
      },
    });

    if (linkedOrderItems > 0) {
      return NextResponse.json(
        { error: "لا يمكن حذف منتج مرتبط بأوردرات مسجلة بالفعل" },
        { status: 400 }
      );
    }

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "تعذر حذف المنتج" }, { status: 400 });
  }
}