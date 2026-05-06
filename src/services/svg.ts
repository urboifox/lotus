import useCustomQuery from "@/config/useCustomQuery";

export const GetAllGardners = () => {
  const { data, isLoading, error, refetch } = useCustomQuery({
    queryKey: ["gardners"],
    url: "/gardners/",
  });
  return { data, isLoading, error, refetch };
};
export const GetGardnerByName = (name: string) => {
  const { data, isLoading, error, refetch } = useCustomQuery({
    queryKey: ["gardners", name],
    url: `/gardners/${name}`,
    staleTime: 1000 * 60 * 10,
  });
  return { data, isLoading, error, refetch };
};
interface GetGardnerBytranslationParams {
  language?: string | null;
  search_term?: string | null;
  is_vertical?: boolean | null;
  is_horizontal?: boolean | null;
  is_circular?: boolean | null;
  is_oval?: boolean | null;
}

export const GetGardnerBytranslation = (
  params: GetGardnerBytranslationParams
) => {
  const {
    language,
    search_term,
    is_vertical,
    is_horizontal,
    is_circular,
    is_oval,
  } = params;
  const queryParams: Record<string, string | boolean> = {};
  if (language !== undefined && language !== null)
    queryParams.language = language;
  if (search_term !== undefined && search_term !== null)
    queryParams.search_term = search_term;
  if (is_vertical !== undefined && is_vertical !== null)
    queryParams.is_vertical = is_vertical;
  if (is_horizontal !== undefined && is_horizontal !== null)
    queryParams.is_horizontal = is_horizontal;
  if (is_circular !== undefined && is_circular !== null)
    queryParams.is_circular = is_circular;
  if (is_oval !== undefined && is_oval !== null) queryParams.is_oval = is_oval;

  const { data, isLoading, error, refetch } = useCustomQuery({
    queryKey: ["gardners", "details", "search", JSON.stringify(queryParams)],
    url: `/gardners/details/search`,
    config: {
      params: queryParams,
    },
    enabled: search_term ? search_term.trim() !== "" : true,
  });
  return { data, isLoading, error, refetch };
};
