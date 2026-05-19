import { dirname } from "path";
import { SFTPWrapper } from "ssh2";
import { promisify } from "util";

export class SftpError extends Error {
  constructor(e: Error) {
    super("SFTP operation failed：" + e.message, { cause: e });
  }
}

export const handleSftpError =
  <TReturn, TParams extends any[]>(func: (...params: TParams) => Promise<TReturn>) =>
  (...params: TParams) => {
    return func(...params).catch((e) => {
      throw new SftpError(e);
    });
  };

export const sftpExists = (sftp: SFTPWrapper, path: string) =>
  new Promise<boolean>((res) => {
    sftp.stat(path, (err) => res(err === undefined));
  }).catch((e) => {
    throw new SftpError(e);
  });

export const sftpWriteFile = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.writeFile.bind(sftp)));

export const sftpReadFile = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.readFile.bind(sftp)));

export const sftpReaddir = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.readdir.bind(sftp)));

export const sftpChmod = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.chmod.bind(sftp)));

export const sftpChown = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.chown.bind(sftp)));

export const sftpRealPath = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.realpath.bind(sftp)));

export const sftpStat = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.stat.bind(sftp)));

export const sftpLstat = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.lstat.bind(sftp)));

export const sftpStatOrUndefined = (sftp: SFTPWrapper) => (path: string) => sftpStat(sftp)(path).catch(() => undefined);

export const sftpUnlink = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.unlink.bind(sftp)));

export const sftpRmdir = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.rmdir.bind(sftp)));

export const sftpRename = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.rename.bind(sftp)));

export const sftpMkdir = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.mkdir.bind(sftp)));

export const sftpAppendFile = (sftp: SFTPWrapper) => handleSftpError(promisify(sftp.appendFile.bind(sftp)));

export const createDirectoriesRecursively = async (sftp: SFTPWrapper, directory: string) => {
  const parentDirectory = dirname(directory);
  if (parentDirectory && parentDirectory !== directory) {
    if (!(await sftpExists(sftp, parentDirectory))) {
      await createDirectoriesRecursively(sftp, parentDirectory);
    }
  }
  if (!(await sftpExists(sftp, directory))) {
    await sftpMkdir(sftp)(directory);
  }
};
