// Common types used across features

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface SelectOption {
  label: string;
  value: string;
}

export type Status = "active" | "inactive" | "pending" | "suspended";

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
