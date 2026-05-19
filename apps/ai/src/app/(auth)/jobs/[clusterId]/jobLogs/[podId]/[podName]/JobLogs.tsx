import { debounce } from "@scow/lib-web/build/utils/debounce";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { join } from "path";
import { useEffect, useRef } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { styled } from "styled-components";

const TerminalContainer = styled.div`
  background-color: black;
  flex: 1;

  width: 100%;
`;

interface Props {
  user: ClientUserInfo;
  cluster: string;
  podId: string;
  rowLimit?: number;
}

export const JobLogs: React.FC<Props> = ({ user, cluster, podId, rowLimit }) => {
  const {
    publicConfig: { BASE_PATH },
  } = usePublicConfig();

  const container = useRef<HTMLDivElement>(null);
  const terminalInitialized = useRef<boolean>(false);

  useEffect(() => {
    if (container.current && !terminalInitialized.current) {
      const term = new Terminal({
        cursorBlink: true,
        scrollback: rowLimit ?? Number.MAX_SAFE_INTEGER,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container.current);
      terminalInitialized.current = true;

      term.write(`*** Connecting to cluster ${cluster} for pod ${podId} as as ${user.identityId} ***\r\n`);

      // === 使用 SSE 连接日志流 ===
      const url = new URL(join(BASE_PATH, `api/jobs/podLogs/${podId}`), window.location.origin);
      url.searchParams.set("cluster", cluster);
      if (rowLimit) {
        url.searchParams.set("rowLimit", rowLimit.toString());
      }
      const eventSource = new EventSource(url.toString());

      eventSource.onmessage = (e) => {
        try {
          const { log } = JSON.parse(e.data);
          log.split(/\r?\n/).forEach((line: string) => {
            if (line.trim() !== "") {
              term.writeln(line);
            }
          });
        } catch (err) {
          console.error("Error onmessage logs:", err);
          term.write("\r\n[Error parsing log data]\r\n");
        }
      };

      eventSource.onerror = (err) => {
        term.write("\r\n[Error receiving logs. Connection closed.]\r\n");
        console.error("Error receiving logs:", err);
        eventSource.close();
      };

      const resizeObserver = new ResizeObserver(
        debounce(() => {
          fitAddon.fit();
        }),
      );

      resizeObserver.observe(container.current);

      return () => {
        eventSource.close();
        term.dispose();
        terminalInitialized.current = false;
      };
    }
  }, [container.current, rowLimit]);

  return <TerminalContainer ref={container} />;
};
