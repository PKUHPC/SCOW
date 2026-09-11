export interface IGroupService {
  /** 检查组是否存在 */
  checkGroupExists(groupName: string): Promise<boolean>;

  /** 创建组，若已存在则抛出错误 */
  createGroup(groupName: string): Promise<void>;

  /** 删除组 */
  deleteGroup(groupName: string): Promise<void>;

  /** 将用户加入组（幂等：用户已在组中时不报错） */
  addUserToGroup(username: string, groupName: string): Promise<void>;

  /** 将用户从组移除（幂等：用户不在组中时不报错） */
  removeUserFromGroup(username: string, groupName: string): Promise<void>;

  /** 列出用户所属的所有组（含组名和 gidNumber） */
  listUserGroups(username: string): Promise<{ name: string; gid: number | undefined }[]>;

  /** 获取用户的主组名，用户不存在时返回 undefined */
  getUserPrimaryGroup(username: string): Promise<string | undefined>;

  /** 设置用户的主组 */
  setUserPrimaryGroup(username: string, groupName: string): Promise<void>;

  /** 通过 gidNumber 直接设置用户的主组 */
  setUserPrimaryGroupByGidNumber(username: string, gidNumber: number): Promise<void>;

  /** 获取组的 gidNumber，组不存在时返回 undefined */
  getGroupGid(groupName: string): Promise<number | undefined>;

  /** 通过 gidNumber 获取组名，组不存在时返回 undefined */
  getGroupNameByGid(gid: number): Promise<string | undefined>;

  /** 获取用户的 uidNumber，用户不存在时返回 undefined */
  getUserUidNumber(username: string): Promise<number | undefined>;
}
