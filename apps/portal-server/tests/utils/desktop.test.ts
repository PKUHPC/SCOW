/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { Status } from "@grpc/grpc-js/build/src/constants";
import { executeAsUser, getUserHomedir, sshRmrf } from "@scow/lib-ssh";
import { RemoteControlTool } from "@scow/protos/build/portal/desktop";
import { dirname, join } from "path";
import {
  addDesktopToFile,
  DesktopInfo,
  ensureEnabled,
  getDesktopConfig,
  getUserDesktopsFilePath,
  listUserDesktopsFromHost,
  readDesktopsFile,
  removeDesktopFromFile,
} from "src/utils/desktops";
import {
  anotherHostDesktopInfo,
  connectToTestServerAsRoot,
  createDesktopsFile,
  desktopTestsFolder,
  resetTestServerAsRoot,
  rootUserId,
  target,
  testDesktopInfo,
  testDesktopsFilePath,
  TestSshServer,
  userId,
} from "tests/file/utils";


let testServer: TestSshServer;

const testCluster = "testCluster";
const listOutput = `
TurboVNC sessions:

X DISPLAY #     PROCESS ID      NOVNC PROCESS ID
:1\t\t21468
`;
const mockExecuteAsUserReturn = {
  code: 0,
  signal: null,
  stdout: listOutput,
  stderr: "",
};

const addedDesktopInfo: DesktopInfo = {
  host: target,
  desktopName: "new-desktop",
  displayId: 2,
  wm: "xfce",
};

jest.mock("@scow/lib-ssh", () => {
  const originalModule = jest.requireActual("@scow/lib-ssh");


  return {
    __esModule: true,
    ...originalModule,
    executeAsUser: jest.fn(),
    getUserHomedir:jest.fn(),
  };
});

jest.mock("@scow/config/build/cluster", () => {
  return {
    getClusterConfigs: jest.fn().mockReturnValue({
      testCluster: {
        loginDesktop:{
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
    getPortalConfig:
    jest.fn().mockReturnValue({
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

beforeEach(async () => {
  testServer = await connectToTestServerAsRoot();
  await createDesktopsFile(testServer);
});

afterEach(async () => {
  await resetTestServerAsRoot(testServer);
});


const desktopDir = getDesktopConfig(testCluster).desktopsDir;

it.each([
  [rootUserId, join("/root", desktopDir, "desktops.json")],
  [userId, join("/home/test", desktopDir, "desktops.json")],
])("should return the correct desktops file path of user %p to %p", async (user, expected) => {
  const userHomeDir = user === rootUserId ? "/root" : "/home/test";
  (getUserHomedir as jest.Mock).mockImplementation(() => {
    return Promise.resolve(userHomeDir);
  });
  expect(await getUserDesktopsFilePath(testServer.ssh, testCluster, user, console)).toBe(expected);

  // clear dir of /scow/desktops
  await sshRmrf(testServer.ssh, dirname(join(userHomeDir, desktopDir)));
});

it("should return correct desktops if desktop.json exist", async () => {

  const desktops = await readDesktopsFile(testServer.ssh, testDesktopsFilePath);
  expect(desktops).toStrictEqual([
    testDesktopInfo,
    anotherHostDesktopInfo,
  ]);
});

it("should return an empty array if desktop.json does not exist", async () => {

  const testDesktopsFilePath = "/path/to/nonexistent/desktops.json";

  const desktops = await readDesktopsFile(testServer.ssh, testDesktopsFilePath);

  expect(desktops).toEqual([]);
});


// // test listDesktopsFromHost
it("should return an array of desktops from host", async () => {

  (executeAsUser as jest.Mock).mockReturnValue(mockExecuteAsUserReturn);
  (getUserHomedir as jest.Mock).mockReturnValue(join("/home/test", desktopTestsFolder()));

  const desktops = await listUserDesktopsFromHost(target, testCluster, userId, console);
  expect(executeAsUser).toHaveBeenCalledTimes(4);
  expect(desktops).toEqual(
    {
      host: target,
      desktops: [{
        displayId: testDesktopInfo.displayId,
        desktopName: testDesktopInfo.desktopName,
        wm: testDesktopInfo.wm,
        remoteControlTool: RemoteControlTool.VNC,
        createTime: undefined }],
    },
  );
});

// // test addDesktopToFile
it("should add a correct desktop to desktops.json", async () => {

  (getUserHomedir as jest.Mock).mockReturnValue(join("/home/test", desktopTestsFolder()));
  await addDesktopToFile(testServer.ssh, testCluster, userId, addedDesktopInfo, console);

  const desktops = await readDesktopsFile(testServer.ssh, testDesktopsFilePath);
  expect(desktops).toStrictEqual([
    testDesktopInfo,
    anotherHostDesktopInfo,
    addedDesktopInfo,
  ]);
},
);

// // test removeDesktopFromFile
it("should remove a corrrect desktop from desktops.json", async () => {

  (getUserHomedir as jest.Mock).mockReturnValue(join("/home/test", desktopTestsFolder()));
  await removeDesktopFromFile(testServer.ssh, testCluster, userId, target, addedDesktopInfo.displayId, console);

  const desktops = await readDesktopsFile(testServer.ssh, testDesktopsFilePath);
  expect(desktops).toStrictEqual([
    testDesktopInfo,
    anotherHostDesktopInfo,
  ]);
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
