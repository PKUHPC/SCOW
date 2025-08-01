import { z } from "zod";

export const paginationSchema = z.object({
  page: z.number().min(1).optional(),
  pageSize: z.number().min(0).optional(),
});


/**
 * @description Paginate items
 * @param items items to be paginated
 * @param page page number
 * @param pageSize page size
 * @returns paginated items and total count
 */
export function paginate<T>(
  items: T[],
  page: number | undefined,
  pageSize: number | undefined,
): { paginatedItems: T[], totalCount: number } {
  const totalCount = items.length;

  if (page === undefined || pageSize === undefined) {
    return { paginatedItems: items, totalCount };
  }

  const startIndex = (page - 1) * pageSize;
  if (startIndex >= totalCount || pageSize <= 0) {
    return { paginatedItems: [], totalCount };
  }

  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const paginatedItems = items.slice(startIndex, endIndex);

  return { paginatedItems, totalCount };
}
