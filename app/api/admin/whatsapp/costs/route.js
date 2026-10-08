import { NextResponse } from "next/server";
import { whatsappRoute } from "@/lib/whatsapp/apiHelpers";
import { costsData } from "@/lib/whatsapp/analytics";

export const dynamic = "force-dynamic";

// Coûts Meta et Claude (§8.3).
export const GET = whatsappRoute("whatsapp.costs", async (request) => {
  const params = request.nextUrl.searchParams;
  return NextResponse.json(await costsData({ from: params.get("from"), to: params.get("to") }));
});
