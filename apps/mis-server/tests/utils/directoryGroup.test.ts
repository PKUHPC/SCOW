import { status } from "@grpc/grpc-js";
import {
  ensureExistingAccountGroupBelongsToOwner,
  validateUserAccountGroupBeforeJoin,
} from "src/utils/directoryGroup";

const logger = { warn: jest.fn(), error: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
});

it("allows a user that only belongs to the per-user default group", async () => {
  const groupService = {
    listUserGroups: jest.fn(async () => [{ name: "user1", gid: 1000 }]),
    getUserPrimaryGroup: jest.fn(async () => "user1"),
  };

  await expect(validateUserAccountGroupBeforeJoin(
    groupService as any,
    "user1",
    "account1",
    { directoryService: { ldap: { addUser: { groupStrategy: "newGroupPerUser" } } } } as any,
    logger as any,
  )).resolves.toEqual(expect.objectContaining({ primaryGroup: "user1" }));
});

it("allows the target account group as an idempotent LDAP residue", async () => {
  const groupService = {
    listUserGroups: jest.fn(async () => [
      { name: "user1", gid: 1000 },
      { name: "account1", gid: 2000 },
    ]),
    getUserPrimaryGroup: jest.fn(async () => "account1"),
  };

  await expect(validateUserAccountGroupBeforeJoin(
    groupService as any,
    "user1",
    "account1",
    { directoryService: { ldap: { addUser: { groupStrategy: "newGroupPerUser" } } } } as any,
    logger as any,
  )).resolves.toEqual(expect.objectContaining({ primaryGroup: "account1" }));
});

it("rejects a user that belongs to another LDAP account group", async () => {
  const groupService = {
    listUserGroups: jest.fn(async () => [
      { name: "user1", gid: 1000 },
      { name: "old-account", gid: 2000 },
    ]),
    getUserPrimaryGroup: jest.fn(async () => "old-account"),
  };

  await expect(validateUserAccountGroupBeforeJoin(
    groupService as any,
    "user1",
    "account1",
    { directoryService: { ldap: { addUser: { groupStrategy: "newGroupPerUser" } } } } as any,
    logger as any,
  )).rejects.toMatchObject({
    code: status.FAILED_PRECONDITION,
    details: "USER_LDAP_ACCOUNT_GROUP_CONFLICT:old-account",
  });
});

it("excludes a shared default group resolved by gid", async () => {
  const groupService = {
    getGroupNameByGid: jest.fn(async () => "users"),
    listUserGroups: jest.fn(async () => [
      { name: "users", gid: 1000 },
      { name: "account1", gid: 2000 },
    ]),
    getUserPrimaryGroup: jest.fn(async () => "users"),
  };

  await expect(validateUserAccountGroupBeforeJoin(
    groupService as any,
    "user1",
    "account1",
    {
      directoryService: {
        ldap: { addUser: { groupStrategy: "oneGroupForAllUsers", oneGroupForAllUsers: { gidNumber: 1000 } } },
      },
    } as any,
    logger as any,
  )).resolves.toEqual(expect.objectContaining({ primaryGroup: "users" }));
});

it("allows account creation to reuse an LDAP group associated with the same owner", async () => {
  const groupService = {
    listUserGroups: jest.fn(async () => [{ name: "account1", gid: 2000 }]),
    getUserPrimaryGroup: jest.fn(async () => "user1"),
  };

  await expect(ensureExistingAccountGroupBelongsToOwner(
    groupService as any,
    "account1",
    "account1",
    "user1",
    logger as any,
  )).resolves.toBeUndefined();

  expect(logger.warn).toHaveBeenCalledWith(
    expect.objectContaining({ recoveryDecision: "reuse", ownerIsMember: true }),
    expect.any(String),
  );
});

it("rejects account creation when an existing LDAP group cannot be associated with the owner", async () => {
  const groupService = {
    listUserGroups: jest.fn(async () => [{ name: "user1", gid: 1000 }]),
    getUserPrimaryGroup: jest.fn(async () => "user1"),
  };

  await expect(ensureExistingAccountGroupBelongsToOwner(
    groupService as any,
    "account1",
    "account1",
    "user1",
    logger as any,
  )).rejects.toMatchObject({
    code: status.ALREADY_EXISTS,
    details: "DIRECTORY_GROUP_ALREADY_EXISTS",
  });

  expect(logger.error).toHaveBeenCalledWith(
    expect.objectContaining({ recoveryDecision: "reject", ownerIsMember: false }),
    expect.any(String),
  );
});
