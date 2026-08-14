import { NextResponse } from "next/server";
import { getVaultStatus } from "@/lib/vault/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getVaultStatus());
}
