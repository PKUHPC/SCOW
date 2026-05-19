export const DEFAULT_PAGE_SIZE = 50;

export const paginationProps = (page?: number, pageSize: number = DEFAULT_PAGE_SIZE) => ({
  offset: ((page ?? 1) - 1) * pageSize,
  limit: pageSize,
});

export const DATETIME_TYPE = "DATETIME(6)";

export const CURRENT_TIMESTAMP = "CURRENT_TIMESTAMP(6)";
