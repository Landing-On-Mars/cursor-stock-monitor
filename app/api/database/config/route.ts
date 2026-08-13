import { NextResponse } from "next/server";
import { databaseStatus, setDatabaseDir } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(databaseStatus());
}

export async function POST(request: Request) {
  let body: { path?: string };
  try {
    body = (await request.json()) as { path?: string };
  } catch {
    return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  const folder = body.path?.trim();
  if (!folder) {
    return NextResponse.json({ error: "请提供同步文件夹路径。" }, { status: 400 });
  }

  try {
    setDatabaseDir(folder);
    return NextResponse.json(databaseStatus());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存数据库路径失败。" },
      { status: 400 },
    );
  }
}
