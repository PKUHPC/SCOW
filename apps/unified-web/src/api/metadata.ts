import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { getScowPath, USE_MOCK } from "src/config/runtime";
import { mockMetadata } from "src/mocks/metadata";

export interface ScowMetadata {
  basePath: string;
  version: string;
  components: Partial<Record<"portal" | "mis" | "ai" | "quantum" | "notification" | "resource", string>>;
}

const metadataUrl = getScowPath("/meta");

export const useMetadataQuery = () =>
  useQuery({
    queryKey: ["app", "metadata"],
    queryFn: async () =>
      USE_MOCK ? mockMetadata : (await axios.get<ScowMetadata>(metadataUrl, { withCredentials: true })).data,
    staleTime: Number.POSITIVE_INFINITY,
  });
