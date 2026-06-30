import { NextResponse } from "next/server";
import { getFilters } from "@/lib/iptv";

export const revalidate = 3600;

export async function GET() {
  try {
    const filters = await getFilters();
    return NextResponse.json(filters);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load filters" },
      { status: 502 },
    );
  }
}
