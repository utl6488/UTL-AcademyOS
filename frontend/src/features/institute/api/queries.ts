import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { parseApiResponse } from "@/lib/api-response";
import { instituteResponseSchema, type Institute } from "../schemas/institute-schemas";

export function useInstituteProfile() {
  return useQuery({
    queryKey: qk.institute.profile(),
    queryFn: async () => {
      const data = await api.get<Institute>("/institute/profile");
      return parseApiResponse(instituteResponseSchema, data);
    },
  });
}
