import { Ref, Reference } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/mysql";

export const DEFAULT_PAGE_SIZE = 50;

export const paginationProps = (page?: number, pageSize: number = DEFAULT_PAGE_SIZE) => ({
  offset: ((page ?? 1) - 1) * pageSize,
  limit: pageSize,
});

export type EntityOrRef<T extends object> = T | Ref<T>;

export function toRef<T extends object>(t: EntityOrRef<T>): Ref<T> {
  if (t instanceof Reference) {
    return t as Ref<T>;
  } else {
    return Reference.create(t);
  }
}

export async function reloadEntity(em: EntityManager, entity: any) {
  await em.refresh(entity);
}

export async function reloadEntities(em: EntityManager, entities: any[]) {
  await Promise.all(entities.map((e) => reloadEntity(em, e)));
}

export const DATETIME_TYPE = "DATETIME(6)";

export const CURRENT_TIMESTAMP = "CURRENT_TIMESTAMP(6)";
