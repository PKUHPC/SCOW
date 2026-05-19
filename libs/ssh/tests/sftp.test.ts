import {
  sftpChmod,
  sftpChown,
  SftpError,
  sftpMkdir,
  sftpReaddir,
  sftpReadFile,
  sftpRealPath,
  sftpRename,
  sftpRmdir,
  sftpStat,
  sftpUnlink,
  sftpWriteFile,
} from "../src/sftp";
import { connectToTestServerAsRoot, resetTestServerAsRoot, TestSshServer } from "./utils";

let testServer: TestSshServer;

beforeEach(async () => {
  testServer = await connectToTestServerAsRoot();
});

afterEach(async () => {
  await resetTestServerAsRoot(testServer);
});

it.each([
  { fn: sftpWriteFile, args: ["/data/home/newfile", Buffer.alloc(0)] },
  { fn: sftpReadFile, args: ["/data/home/demo_admin"] },
  { fn: sftpReaddir, args: ["/data/home/test"] },
  { fn: sftpChmod, args: ["/data/home/test", "555"] },
  { fn: sftpChown, args: ["/data/home/test", 512, 555] },
  { fn: sftpRealPath, args: ["/data/home/test"] },
  { fn: sftpStat, args: ["/data/home"] },
  { fn: sftpUnlink, args: ["/data/home/test"] },
  { fn: sftpRmdir, args: ["/data/home/test"] },
  { fn: sftpRename, args: ["/data/home/test", "/data/home/testNew"] },
  { fn: sftpMkdir, args: ["/data/home/test"] },
])("$fn.name should catch error and throw SftpError ", async ({ fn, args }) => {
  try {
    await fn(testServer.sftp)(...(args as any[]));
    expect("").fail("should not reach here");
  } catch (e) {
    expect(e).toBeInstanceOf(SftpError);
  }
});
