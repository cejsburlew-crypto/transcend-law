/**
 * Standard API envelope returned by the CodeIgniter backend.
 * Used by both bond-intelligence and SSP frontends.
 */
export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
  meta: {
    timestamp: string;
    version: string;
    pagination?: PaginationMeta;
  };
}
