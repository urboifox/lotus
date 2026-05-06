import { useQuery } from "@tanstack/react-query";
import type { AxiosRequestConfig } from "axios";
import { apiClient } from "./axios.config";

interface IAuthenticatedQuery {
  queryKey: string[];
  url: string;
  config?: AxiosRequestConfig;
  enabled?: boolean;
  retry?: number;
  retryDelay?: number | ((attempt: number) => number);
  staleTime?: number;
}
const useCustomQuery = ({
  queryKey,
  url,
  config,
  enabled = true,
  retry = 2,
  retryDelay,
  staleTime = 1000 * 60 * 5,
}: IAuthenticatedQuery) => {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await apiClient.get(url, config);
      return data;
    },
    enabled: enabled,
    retry: retry,
    retryDelay: retryDelay ?? ((attempt) => Math.min(1000 * 2 ** attempt, 10_000)),
    staleTime: staleTime,
  });
};

export default useCustomQuery;
