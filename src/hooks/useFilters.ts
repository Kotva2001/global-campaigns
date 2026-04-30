import { useMemo, useState } from "react";
import type { CampaignEntry, Platform } from "@/types/campaign";
import { normalize } from "@/lib/normalize";

export type PlatformFilter = "All" | Platform;

export const useFilters = (allRows: CampaignEntry[]) => {
  const [selectedCountry, setSelectedCountry] = useState<string>("All");
  const [platform, setPlatform] = useState<PlatformFilter>("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return allRows.filter((r) => {
      if (selectedCountry !== "All" && r.country !== selectedCountry) return false;
      if (platform !== "All" && r.platform !== platform) return false;
      if (q && !normalize(r.influencer).includes(q) && !normalize(r.campaignName).includes(q))
        return false;
      return true;
    });
  }, [allRows, selectedCountry, platform, search]);

  const hasActiveFilter = platform !== "All" || search.trim().length > 0;

  const clear = () => {
    setPlatform("All");
    setSearch("");
  };

  return {
    selectedCountry,
    setSelectedCountry,
    platform,
    setPlatform,
    search,
    setSearch,
    filtered,
    hasActiveFilter,
    clear,
  };
};
