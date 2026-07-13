import { WebSocketTerminal } from "@scow/lib-web/build/components/shell/WebSocketTerminal";
import { join } from "path";
import { urlToDownload } from "src/pageComponents/filemanager/api";
import { publicConfig } from "src/utils/config";

interface Props {
  userId: string;
  cluster: string;
  loginNode: string;
  path: string;
  useRootEnabled: boolean;
}

const OPEN_EXPLORER_PREFIX = "SCOW is opening the file system";
const DOWNLOAD_FILE_PREFIX = "SCOW is downloading file ";
const DOWNLOAD_FILE_SUFFIX = " in directory ";
const EDIT_FILE_PREFIX = "SCOW is redirecting to the editor for the file ";
const EDIT_FILE_SUFFIX = " in directory ";
const UPLOAD_FILE_PREFIX = "SCOW is uploading files in directory ";

const processShellOutput = (dataString: string) => {
  const result = dataString.trim().split("\r\n")[0];

  const pathStartIndex = result.search("/");
  const path = result.substring(pathStartIndex);

  return { result, path };
};

export const Shell: React.FC<Props> = ({ userId, cluster, loginNode, path, useRootEnabled }) => {
  const getWsUrl = ({ cols, rows }: { cols: number; rows: number }) => {
    const payload = {
      cluster,
      loginNode,
      path,
      cols: cols + "",
      rows: rows + "",
      useRoot: useRootEnabled ? "true" : "false", // 通过http api的权限验证，通知websocket需要验证useRoot。
    };

    return (
      (location.protocol === "http:" ? "ws" : "wss") +
      "://" +
      location.host +
      join(publicConfig.BASE_PATH, "/api/shell") +
      "?" +
      new URLSearchParams(payload).toString()
    );
  };

  const handleData = (_data: Uint8Array, dataString: string) => {
    if (dataString.includes(OPEN_EXPLORER_PREFIX)) {
      const { path } = processShellOutput(dataString);
      window.open(join(publicConfig.BASE_PATH, "/files", cluster, path));
    } else if (dataString.includes(DOWNLOAD_FILE_PREFIX)) {
      const { result, path } = processShellOutput(dataString);
      const fileStartIndex = result.search(DOWNLOAD_FILE_PREFIX);
      const fileEndIndex = result.search(DOWNLOAD_FILE_SUFFIX);
      const file = result.substring(fileStartIndex + DOWNLOAD_FILE_PREFIX.length, fileEndIndex);
      window.location.href = urlToDownload(cluster, join(path, file), true);
    } else if (dataString.includes(EDIT_FILE_PREFIX)) {
      const { result, path } = processShellOutput(dataString);
      const fileStartIndex = result.search(EDIT_FILE_PREFIX);
      const fileEndIndex = result.search(EDIT_FILE_SUFFIX);
      const file = result.substring(fileStartIndex + EDIT_FILE_PREFIX.length, fileEndIndex);
      window.open(join(publicConfig.BASE_PATH, "/files", cluster, path + "?edit=" + file));
    } else if (dataString.includes(UPLOAD_FILE_PREFIX)) {
      const { path } = processShellOutput(dataString);
      window.open(join(publicConfig.BASE_PATH, "/files", cluster, path + "?uploadModalOpen=true"));
    }
  };

  return (
    <WebSocketTerminal
      getWsUrl={getWsUrl}
      connectMessage={
        `\r\n*** Connecting to cluster ${cluster} as ${userId} to ` +
        `${path ? "path " + path : "home path"} ***\r\n`
      }
      onData={handleData}
    />
  );
};
