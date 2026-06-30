import { NextRequest, NextResponse } from "next/server";
import { queryChannels } from "@/lib/iptv";
import type { ChannelQuery } from "@/lib/types";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sortParam = sp.get("sort");
  const sort: ChannelQuery["sort"] =
    sortParam === "country" || sortParam === "quality" ? sortParam : "name";

  const list = (key: string): string[] | undefined => {
    const raw = sp.get(key);
    if (!raw) return undefined;
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  };

  try {
    const result = await queryChannels({
      search: sp.get("search") ?? undefined,
      countries: list("country"),
      categories: list("category"),
      languages: list("language"),
      qualities: list("quality"),
      nsfw: sp.get("nsfw") === "true",
      sort,
      page: Number(sp.get("page")) || 1,
      pageSize: Number(sp.get("pageSize")) || 60,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load channels" },
      { status: 502 },
    );
  }
}
