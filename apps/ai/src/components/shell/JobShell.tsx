import { debounce } from "@scow/lib-web/build/utils/debounce";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { join } from "path";
import { useEffect, useRef } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { ShellInputData, ShellOutputData } from "src/server/setup/jobShell";
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
  jobId: string;
  namespace: string;
  podName: string;
}

export const JobShell: React.FC<Props> = ({ user, cluster, jobId, namespace, podName }) => {
  const {
    publicConfig: { BASE_PATH },
  } = usePublicConfig();

  const container = useRef<HTMLDivElement>(null);
  const terminalInitialized = useRef<boolean>(false);

  useEffect(() => {
    if (container.current && !terminalInitialized.current) {
      const term = new Terminal({
        cursorBlink: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container.current);
      terminalInitialized.current = true;

      const payload = {
        cluster,
        jobId,
        namespace,
        podName,
      };

      term.write(`*** Connecting to cluster ${payload.cluster} as ${user.identityId} \r\n`);

      const socket = new WebSocket(
        (location.protocol === "http:" ? "ws" : "wss") +
          "://" +
          location.host +
          join(BASE_PATH, "/api/jobShell") +
          "?" +
          new URLSearchParams(payload).toString(),
      );

      socket.onmessage = (e) => {
        const message = JSON.parse(e.data) as ShellOutputData;
        switch (message.$case) {
          case "data": {
            const raw = message.data.data;
            if (typeof raw === "string") {
              term.write(new TextEncoder().encode(raw));
              break;
            }
            if (Array.isArray(raw)) {
              term.write(Uint8Array.from(raw));
              break;
            }
            if (raw && raw.type === "Buffer" && Array.isArray(raw.data)) {
              term.write(Uint8Array.from(raw.data));
            }
            break;
          }
          case "exit":
            term.write(`Process exited with code ${message.exit.code} and signal ${message.exit.signal}.`);
            break;
        }
      };

      socket.onopen = () => {
        term.clear();

        const send = (data: ShellInputData) => {
          socket.send(JSON.stringify(data));
        };

        const resizeObserver = new ResizeObserver(
          debounce(() => {
            fitAddon.fit();
            send({ $case: "resize", resize: { cols: term.cols, rows: term.rows } });
          }),
        );

        resizeObserver.observe(container.current!);

        term.onData((data) => {
          send({ $case: "data", data: { data } });
        });
      };

      return () => {
        if (socket) socket.close();
        if (term) term.dispose();
        terminalInitialized.current = false;
      };
    }
  }, [container.current]);

  return <TerminalContainer ref={container} />;
};
