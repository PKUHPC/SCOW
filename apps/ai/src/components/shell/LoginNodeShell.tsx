import { WebSocketTerminal } from "@scow/lib-web/build/components/shell/WebSocketTerminal";
import { join } from "path";
import { usePublicConfig } from "src/app/(auth)/context";

interface Props {
  cluster: string;
  loginNode: string;
  path: string;
}

export const LoginNodeShell: React.FC<Props> = ({ cluster, loginNode, path }) => {
  const {
    publicConfig: { BASE_PATH },
  } = usePublicConfig();

  const getWsUrl = ({ cols, rows }: { cols: number; rows: number }) => {
    const payload = {
      cluster,
      loginNode,
      path,
      cols: cols + "",
      rows: rows + "",
    };

    return (
      (location.protocol === "http:" ? "ws" : "wss") +
      "://" +
      location.host +
      join(BASE_PATH, "/api/shell") +
      "?" +
      new URLSearchParams(payload).toString()
    );
  };

  return (
    <WebSocketTerminal
      getWsUrl={getWsUrl}
      connectMessage={
        `\r\n*** Connecting to cluster ${cluster} as root to ` +
        `${path ? "path " + path : "home path"} ***\r\n`
      }
    />
  );
};
