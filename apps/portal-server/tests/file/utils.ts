import { ServiceError } from "@grpc/grpc-js";
import { LoginNode } from "@scow/config/build/cluster";
import { I18nObject_I18n, I18nStringType } from "@scow/config/build/i18n";
import { sftpWriteFile, sshRawConnect, sshRmrf } from "@scow/lib-ssh";
import { ClusterConfigSchemaProto_LoginNodesProtoType } from "@scow/protos/build/common/config";
import { I18nStringProtoType } from "@scow/protos/build/common/i18n";
import { SubmissionInfo } from "@scow/protos/build/portal/app";
import { camelToUnderscore } from "@scow/utils/build/i18n";
import { randomBytes } from "crypto";
import FormData from "form-data";
import { NodeSSH } from "node-ssh";
import path, { join } from "path";
import { rootKeyPair } from "src/config/env";
import { DesktopInfo } from "src/utils/desktops";
import { SFTPWrapper } from "ssh2";

export const target = "localhost:22222";
export const rootUserId = "root";
export const userId = "test";
export const cluster = "hpc01";

export async function collectInfo<T>(stream: AsyncIterable<T>) {

  const buffer = [] as T[];

  for await (const res of stream) {
    buffer.push(res);
  }

  return buffer;
}

export interface TestSshServer {
  ssh: NodeSSH;
  sftp: SFTPWrapper;
}

export const connectToTestServer = async () => {

  const ssh = await sshRawConnect(target, userId, rootKeyPair, console);

  return { ssh, sftp: await ssh.requestSFTP() } as TestSshServer;
};

export const connectToTestServerAsRoot = async () => {

  const ssh = await sshRawConnect(target, rootUserId, rootKeyPair, console);

  return { ssh, sftp: await ssh.requestSFTP() } as TestSshServer;
};

// connect as root and reset the test folders of user test
export const resetTestServerAsRoot = async (server: TestSshServer) => {
  const base = join("/home/test", path.dirname(desktopTestsFolder()));
  await sshRmrf(server.ssh, base);
  server.ssh.dispose();
};

export const resetTestServer = async (server: TestSshServer) => {
  const base = baseFolder();

  await sshRmrf(server.ssh, path.dirname(base));
  server.ssh.dispose();
};

export async function createFile(sftp: SFTPWrapper, filePath: string) {
  await sftpWriteFile(sftp)(filePath, randomBytes(10));
}

export const baseFolder = () => `tests/testFolder${process.env.JEST_WORKER_ID}/${userId}`;

export const desktopTestsFolder = () => `desktopTests/desktopsTestFolder${process.env.JEST_WORKER_ID}/${userId}`;

export function actualPath(filename: string, basefn: () => string = baseFolder) {
  return path.join(basefn(), filename);
}

// returns base folder
export async function createTestItems({ sftp, ssh }: TestSshServer): Promise<string> {
  const base = baseFolder();
  await ssh.mkdir(path.join(base, "dir1"), undefined, sftp);
  const test1 = path.join(base, "test1");
  await createFile(sftp, test1);

  return base;
}

export function mockFileForm(size: number, filename: string) {
  const formData = new FormData();

  formData.append("file", Buffer.alloc(size, 1), {
    filename,
    contentType: "application/pdf",
    knownLength: size,
  });
  return formData;
}

export async function expectGrpcThrow(promise: Promise<unknown>, expectError: (error: ServiceError) => void) {
  await promise.then(() => expect("").fail("Promise resolved"), expectError);
}

// cereate a lastSubmission file of app[vscode]
export async function createVscodeLastSubmitFile(sftp: SFTPWrapper, filePath: string) {

  const lastSubmissionInfo: SubmissionInfo = {
    userId: "test",
    cluster: "hpc01",
    appId: "vscode",
    appName: "VSCode",
    account: "a_aaaaaa",
    partition: "compute",
    qos: "high",
    nodeCount: 1,
    coreCount: 2,
    maxTime: 10,
    submitTime: "2021-12-22T16:16:02.000Z",
    customAttributes: { selectVersion: "code-server/4.9.0", sbatchOptions: "--time 10" },
  };

  const newFilePath = join(filePath, "last_submission.json");
  await sftpWriteFile(sftp)(newFilePath, JSON.stringify(lastSubmissionInfo));

}

export async function createTestLastSubmissionForVscode({ sftp, ssh }: TestSshServer): Promise<string> {
  const base = baseFolder();
  await ssh.mkdir(path.join(base, "scow/apps/vscode"), undefined, sftp);
  const appId1 = path.join(base, "scow/apps/vscode");

  await createVscodeLastSubmitFile(sftp, appId1);

  return base;
}

export const testDesktopInfo: DesktopInfo = {
  host: target,
  displayId: 1,
  desktopName: "desktop-test11",
  wm: "wm-test",
};

export const anotherHostDesktopInfo: DesktopInfo = {
  host: "anotherHost",
  displayId: 2,
  desktopName: "desktop-test11",
  wm: "wm-test",
};

export const testDesktopDirPath = join("/home/test", actualPath("/scow/desktops", desktopTestsFolder));
export const testDesktopsFilePath = join(testDesktopDirPath, "desktops.json");

export async function createDesktopsFile({ sftp, ssh }: TestSshServer) {
  await ssh.mkdir(testDesktopDirPath, undefined, sftp);
  await sftpWriteFile(sftp)(testDesktopsFilePath, JSON.stringify([testDesktopInfo, anotherHostDesktopInfo]));
}

// 和libs/web/src/utils/typeConversion.ts中的函数一致
// portal-server不可以引用libs/web


// protobuf中定义的grpc返回值的loginNodes类型映射到前端loginNode
export const getLoginNodesTypeFormat = (
  protoType: ClusterConfigSchemaProto_LoginNodesProtoType | undefined): LoginNode[] => {

  if (!protoType?.value) return [];
  if (protoType.value.$case === "loginNodeAddresses") {
    return protoType.value.loginNodeAddresses.loginNodeAddressesValue.map((x) => ({
      name: x,
      address: x,
      scowdPort: undefined,
    }));
  } else {
    const loginNodeConfigs = protoType.value.loginNodeConfigs;
    return loginNodeConfigs.loginNodeConfigsValue.map((x) => ({
      name: getI18nTypeFormat(x.name),
      address: x.address,
      scowdPort: x.scowd?.port,
    }));
  }

};

// protobuf中定义的grpc返回值的类型映射到前端I18nStringType
export const getI18nTypeFormat = (i18nProtoType: I18nStringProtoType | undefined): I18nStringType => {

  if (!i18nProtoType?.value) return "";

  if (i18nProtoType.value.$case === "directString") {
    return i18nProtoType.value.directString;
  }

  const i18nObj = i18nProtoType.value.i18nObject.i18n;
  if (!i18nObj) return "";

  return {
    i18n: {
      ...Object.entries(i18nObj).reduce((acc, [key, value]) => {
        acc[camelToUnderscore(key)] = value;
        return acc;
      }, {} as I18nObject_I18n),
    },
  };
};

