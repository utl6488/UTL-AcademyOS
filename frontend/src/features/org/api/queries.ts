import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { parseApiArrayResponse } from "@/lib/api-response";
import {
  branchSchema,
  classSchema,
  batchSchema,
  subjectSchema,
  topicSchema,
  type Branch,
  type Class,
  type Batch,
  type Subject,
  type Topic,
} from "../schemas/org-schemas";

export function useBranches(filters?: { tenantId?: string }) {
  return useQuery({
    queryKey: qk.org.branches.list(filters),
    queryFn: async () => {
      const data = await api.get<Branch[]>("/org/branches", filters);
      return parseApiArrayResponse(branchSchema, data);
    },
  });
}

export function useClasses(filters?: { branchId?: string; tenantId?: string }) {
  return useQuery({
    queryKey: qk.org.classes.list(filters),
    queryFn: async () => {
      const data = await api.get<Class[]>("/org/classes", filters);
      return parseApiArrayResponse(classSchema, data);
    },
  });
}

export function useBatches(filters?: { classId?: string; tenantId?: string }) {
  return useQuery({
    queryKey: qk.org.batches.list(filters),
    queryFn: async () => {
      const data = await api.get<Batch[]>("/org/batches", filters);
      return parseApiArrayResponse(batchSchema, data);
    },
  });
}

export function useSubjects(filters?: { classId?: string; tenantId?: string }) {
  return useQuery({
    queryKey: qk.org.subjects.list(filters),
    queryFn: async () => {
      const data = await api.get<Subject[]>("/org/subjects", filters);
      return parseApiArrayResponse(subjectSchema, data);
    },
  });
}

export function useTopics(subjectId: string) {
  return useQuery({
    queryKey: qk.org.subjects.topics(subjectId),
    queryFn: async () => {
      const data = await api.get<Topic[]>(`/org/subjects/${subjectId}/topics`);
      return parseApiArrayResponse(topicSchema, data);
    },
    enabled: !!subjectId,
  });
}
