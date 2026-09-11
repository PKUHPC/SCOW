const getGroupGid = jest.fn();
const createGroupService = jest.fn(() => ({ getGroupGid }));

jest.mock("src/config/mis", () => ({
  misConfig: { directoryService: { ldap: {} } },
}));

jest.mock("src/directoryService/groupService", () => ({
  createGroupService,
}));

import {
  getScowdQuotaGroupNameForStorage,
  isNumericScowdQuotaGroupName,
  resolveScowdQuotaGroupNames,
  resolveScowdQuotaGroupNamesBestEffort,
} from "src/utils/scowdQuotaGroupName";

const logger = {
  debug: jest.fn(),
  warn: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  getGroupGid.mockReset();
  createGroupService.mockReset().mockReturnValue({ getGroupGid });
});

it("recognizes only group names containing ASCII digits", () => {
  expect(isNumericScowdQuotaGroupName("10001")).toBe(true);
  expect(isNumericScowdQuotaGroupName("account-10001")).toBe(false);
  expect(isNumericScowdQuotaGroupName("")).toBe(false);
});

it("keeps non-numeric group names without querying LDAP", async () => {
  const result = await resolveScowdQuotaGroupNames(
    ["account-a", "group01a"], [{ fs: { type: "nfs" } } as any], logger as any,
  );

  expect(result.groupNames).toEqual(["account-a", "group01a"]);
  expect(result.groupNameMap).toEqual(
    new Map([
      ["account-a", "account-a"],
      ["group01a", "group01a"],
    ]),
  );
  expect(createGroupService).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
});

it("converts all numeric group names to LDAP gids and logs one batch debug message", async () => {
  getGroupGid.mockImplementation(async (groupName: string) => ({ "10001": 20001, "10002": 20002 })[groupName]);

  const result = await resolveScowdQuotaGroupNames(
    ["10001", "account-a", "10002", "10001"], [{ fs: { type: "nfs" } } as any], logger as any,
  );

  expect(result.groupNames).toEqual(["20001", "account-a", "20002", "20001"]);
  expect(result.groupNameMap).toEqual(
    new Map([
      ["10001", "20001"],
      ["account-a", "account-a"],
      ["10002", "20002"],
    ]),
  );
  expect(getGroupGid).toHaveBeenCalledTimes(2);
  expect(logger.debug).toHaveBeenCalledTimes(1);
  expect(logger.debug).toHaveBeenCalledWith(
    {
      groupNameChanges: [
        { originalGroupName: "10001", gid: 20001, scowdGroupName: "20001" },
        { originalGroupName: "10002", gid: 20002, scowdGroupName: "20002" },
      ],
    },
    "Converted numeric LDAP group names to gids for scowd storage quota request",
  );
});

it("fails the batch when a numeric LDAP group cannot be resolved", async () => {
  getGroupGid.mockImplementation(async (groupName: string) => {
    if (groupName === "10001") return undefined;
    return 20002;
  });

  const error = await resolveScowdQuotaGroupNames(
    ["10001", "10002"],
    [{ fs: { type: "nfs" }, storageId: "nfs", clusterId: "hpc01" } as any],
    logger as any,
  ).catch((e) => e);
  expect(error).toMatchObject({ code: 9, details: "NumericGroupNameResolutionFailed: 10001, 10002" });
  expect(error.metadata.get("failedGroupName")).toEqual(["10001"]);
  expect(error.metadata.get("failedGroupNames")).toEqual(["10001,10002"]);
  expect(logger.warn).toHaveBeenCalledWith(
    {
      numericGroupNames: ["10001", "10002"],
      failedGroupNames: ["10001", "10002"],
      failedGroupName: "10001",
      storages: [{ storageId: "nfs", clusterId: "hpc01", fsType: "nfs" }],
      err: expect.objectContaining({
        message: "Numeric LDAP group '10001' was not found or has no gidNumber",
      }),
    },
    "Failed to resolve numeric LDAP group names to gids for storage quota operation",
  );
});

it("keeps non-numeric items and reports all numeric items when best-effort batch resolution fails", async () => {
  getGroupGid.mockRejectedValue(new Error("LDAP unavailable"));
  const items = [
    { accountName: "numeric-a", groupName: "10001" },
    { accountName: "regular", groupName: "account-a" },
    { accountName: "numeric-b", groupName: "10002" },
  ];

  const result = await resolveScowdQuotaGroupNamesBestEffort(
    items,
    (item) => item.groupName,
    [{ fs: { type: "nfs" }, storageId: "nfs", clusterId: "hpc01" } as any],
    logger as any,
  );

  expect(result.items).toEqual([items[1]]);
  expect(result.failedItems).toEqual([items[0], items[2]]);
  expect(result.groupNameMap).toEqual(new Map([["account-a", "account-a"]]));
  expect(logger.warn).toHaveBeenCalledWith(
    expect.objectContaining({
      failedGroupNames: ["10001", "10002"],
      storages: [{ storageId: "nfs", clusterId: "hpc01", fsType: "nfs" }],
    }),
    "Failed to resolve numeric LDAP group names to gids for storage quota operation",
  );
});

it("does not swallow errors unrelated to numeric group name resolution", async () => {
  const unexpectedError = new Error("unexpected");
  createGroupService.mockImplementationOnce(() => {
    throw unexpectedError;
  });

  await expect(resolveScowdQuotaGroupNamesBestEffort(
    [{ groupName: "10001" }],
    (item) => item.groupName,
    [{ fs: { type: "nfs" } } as any],
    logger as any,
  )).rejects.toBe(unexpectedError);
});

it("keeps numeric group names without querying LDAP when all storages are OceanStor Pacific", async () => {
  const oceanStorPacific = { fs: { type: "oceanStorPacific" } } as any;

  const result = await resolveScowdQuotaGroupNames(["10001"], [oceanStorPacific], logger as any);

  expect(result.groupNameMap.get("10001")).toBe("10001");
  expect(getGroupGid).not.toHaveBeenCalled();
});

it("resolves numeric names up front for mixed storages and selects the name by filesystem", async () => {
  const oceanStorPacific = { fs: { type: "oceanStorPacific" } } as any;
  const nfs = { fs: { type: "nfs" } } as any;
  getGroupGid.mockResolvedValue(20001);

  const { groupNameMap } = await resolveScowdQuotaGroupNames(
    ["10001"],
    [oceanStorPacific, nfs],
    logger as any,
  );

  expect(getGroupGid).toHaveBeenCalledWith("10001");
  expect(getScowdQuotaGroupNameForStorage("10001", oceanStorPacific, groupNameMap)).toBe("10001");
  expect(getScowdQuotaGroupNameForStorage("10001", nfs, groupNameMap)).toBe("20001");
});
