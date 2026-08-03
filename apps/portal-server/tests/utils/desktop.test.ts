import { Status } from "@grpc/grpc-js/build/src/constants";
import { ensureEnabled, getDesktopConfig } from "src/utils/desktops";

const testCluster = "testCluster";

jest.mock("@scow/config/build/cluster", () => {
  return {
    getClusterConfigs: jest.fn().mockReturnValue({
      testCluster: {
        loginDesktop: {
          wms: ["wm1", "wm2"],
          enabled: false,
          maxDesktops: 5,
          desktopsDir: "scow/desktops",
        },
      },
    }),
  };
});

jest.mock("@scow/config/build/portal", () => {
  return {
    getPortalConfig: jest.fn().mockReturnValue({
      loginDesktop: {
        wms: ["wm3", "wm4"],
        enabled: true,
        maxDesktops: 2,
      },
      desktopsDir: "scow/desktops",
      turboVNCPath: "/opt/TurboVNC",
    }),
  };
});

it("return cluster wms when setting wms both in portal and cluster", async () => {
  expect(getDesktopConfig(testCluster).wms).toStrictEqual(["wm1", "wm2"]);
});

it("return cluster logindesktop enabled when setting enabled both in portal and cluster", async () => {
  try {
    ensureEnabled(testCluster);
    expect("").fail("not enabled");
  } catch (e: unknown) {
    const ex = e as { code: Status; message: string };
    expect(ex.code).toBe(Status.UNAVAILABLE);
    expect(ex.message).toContain("Login desktop is not enabled");
  }
});

it("return cluster maxDesktops when setting maxDesktops both in portal and cluster", async () => {
  expect(getDesktopConfig(testCluster).maxDesktops).toBe(5);
});
