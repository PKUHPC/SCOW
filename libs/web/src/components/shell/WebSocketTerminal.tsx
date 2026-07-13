import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import type { IDisposable } from "@xterm/xterm";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { styled } from "styled-components";

import { debounce } from "src/utils/debounce";

const TerminalContainer = styled.div`
  background-color: black;
  flex: 1;

  width: 100%;
`;

export type ShellInputData =
  | { $case: "resize"; resize: { cols: number; rows: number } }
  | { $case: "data"; data: { data: string } }
  | { $case: "disconnect" };

type ShellOutputRawData = number[] | { type: "Buffer"; data: number[] } | string;

export type ShellOutputData =
  | { $case: "data"; data: { data: ShellOutputRawData } }
  | { $case: "exit"; exit: { code?: number; signal?: string } };

interface Props {
  getWsUrl: (terminalSize: { cols: number; rows: number }) => string;
  connectMessage: string;
  onData?: (data: Uint8Array, dataString: string) => void;
}

const shellOutputToUint8Array = (raw: ShellOutputRawData): Uint8Array | undefined => {
  if (typeof raw === "string") {
    return new TextEncoder().encode(raw);
  }

  if (Array.isArray(raw)) {
    return Uint8Array.from(raw);
  }

  if (raw && raw.type === "Buffer" && Array.isArray(raw.data)) {
    return Uint8Array.from(raw.data);
  }

  return undefined;
};

export const WebSocketTerminal: React.FC<Props> = ({ getWsUrl, connectMessage, onData }) => {
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

      term.write(connectMessage);

      const socket = new WebSocket(getWsUrl({ cols: term.cols, rows: term.rows }));
      let resizeObserver: ResizeObserver | undefined;
      let dataListener: IDisposable | undefined;
      let resizeListener: IDisposable | undefined;

      socket.onmessage = (e) => {
        const message = JSON.parse(e.data) as ShellOutputData;
        switch (message.$case) {
          case "data": {
            const data = shellOutputToUint8Array(message.data.data);
            if (!data) {
              break;
            }

            onData?.(data, new TextDecoder().decode(data));
            term.write(data);
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

        resizeObserver = new ResizeObserver(
          debounce(() => {
            fitAddon.fit();
            send({ $case: "resize", resize: { cols: term.cols, rows: term.rows } });
          }),
        );

        resizeObserver.observe(container.current!);

        dataListener = term.onData((data) => {
          send({ $case: "data", data: { data } });
        });

        resizeListener = term.onResize(({ cols, rows }) => {
          send({ $case: "resize", resize: { cols, rows } });
        });
      };

      return () => {
        resizeObserver?.disconnect();
        dataListener?.dispose();
        resizeListener?.dispose();
        socket.close();
        term.dispose();
        terminalInitialized.current = false;
      };
    }
  }, [container.current]);

  return <TerminalContainer ref={container} />;
};
