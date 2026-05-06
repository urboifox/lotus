import {
  useMutation,
  type UseMutationResult,
  type UseMutationOptions,
} from "@tanstack/react-query";

export function useAuth<TVariables, TData = unknown, TContext = unknown>(
  options: UseMutationOptions<TData, unknown, TVariables, TContext>
): UseMutationResult<TData, unknown, TVariables, TContext> {
  return useMutation<TData, unknown, TVariables, TContext>({
    retry: 1,
    retryDelay: 1000,
    ...options,
  });
}
