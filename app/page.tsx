import Browser from "@/components/Browser";
import { getFilters, queryChannels } from "@/lib/iptv";

// Rebuild the static shell periodically; channel/filter data has its own
// revalidation window inside the data layer.
export const revalidate = 3600;

export default async function HomePage() {
  const [filters, initial] = await Promise.all([
    getFilters(),
    queryChannels({ page: 1, pageSize: 60, sort: "name" }),
  ]);

  return <Browser filters={filters} initial={initial} />;
}
