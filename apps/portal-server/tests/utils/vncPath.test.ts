import { getTurboVNCBinPath, getTurboVNCPath } from "src/utils/turbovnc";

jest.mock("@scow/config/build/cluster", () => {
  return {
    getClusterConfigs: jest.fn().mockReturnValue({ testCluster: { turboVNCPath: "/opt1/TurboVNC" } }),
  };
});

jest.mock("@scow/config/build/portal", () => {
  return {
    getPortalConfig: jest.fn().mockReturnValue({ turboVNCPath: "/opt2/TurboVNC" }),
  };
});

it("should return cluster TurboVNCPath when setting turboVNCPath both in portal and cluster", async () => {
  expect(getTurboVNCPath("testCluster")).toBe("/opt1/TurboVNC");
});

it.each([
  ["testCluster", "vncserver"],
  ["testCluster", "vncpasswd"],
])("should return right VNCCMDPath", async (cluster: string, cmd: string) => {
  if (cmd === "vncserver") {
    expect(getTurboVNCBinPath(cluster, cmd)).toBe("/opt1/TurboVNC/bin/vncserver");
  } else {
    expect(getTurboVNCBinPath(cluster, cmd)).toBe("/opt1/TurboVNC/bin/vncpasswd");
  }
});
