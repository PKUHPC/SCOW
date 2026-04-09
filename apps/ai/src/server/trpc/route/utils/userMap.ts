import { getUsersName } from "src/server/utils/user";

/**
 * 根据一组用户 ID 批量查询用户名，返回 userId → userName 的映射表。
 * 自动去重并过滤空值，若 ID 列表为空则直接返回空对象。
 */
export const buildUserMap = async (ownerIds: string[]): Promise<Record<string, string>> => {
  const ids = Array.from(new Set(ownerIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const users = await getUsersName(ids);
  return users.reduce((acc, u) => {
    acc[u.userId] = u.userName;
    return acc;
  }, {} as Record<string, string>);
};
