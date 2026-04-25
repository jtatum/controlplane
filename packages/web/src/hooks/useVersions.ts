import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "./api.js";

export interface VersionSummary {
  id: string;
  version: string;
  isDefault: boolean;
  releasedAt: string;
}

export function useVersions() {
  return useQuery<VersionSummary[]>({
    queryKey: ["versions"],
    queryFn: () => fetchJson<VersionSummary[]>("/versions"),
  });
}
