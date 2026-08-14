import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "记录 ID 无效。" }, { status: 400 });
  }

  const result = db.prepare("DELETE FROM focus_notes WHERE id = ?").run(parsed);
  if (result.changes === 0) {
    return NextResponse.json({ error: "没有找到这条记录。" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
