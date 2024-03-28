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

import { debounce } from "@scow/lib-web/build/utils/debounce";
import { join } from "path";
import { useEffect, useRef } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { ShellInputData, ShellOutputData } from "src/server/setup/jobShell";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { styled } from "styled-components";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";

const TerminalContainer = styled.div`
  background-color: black;
  flex: 1;

  width: 100%;
`;

interface Props {
  user: ClientUserInfo;
  cluster: string;
  jobId: string;
}

const OPEN_FILE = "This command is only valid for SCOW web shells";
// const OPEN_EXPLORER_PREFIX = "SCOW is opening the file system";
// const DOWNLOAD_FILE_PREFIX = "SCOW is downloading file ";
// const DOWNLOAD_FILE_SUFFIX = " in directory ";
// const EDIT_FILE_PREFIX = "SCOW is redirecting to the editor for the file ";
// const EDIT_FILE_SUFFIX = " in directory ";

export const JobShell: React.FC<Props> = ({ user, cluster, jobId }) => {

  const { publicConfig: { BASE_PATH } } = usePublicConfig();

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
        cols: term.cols + "",
        rows: term.rows + "",
      };

      term.write(
        `*** Connecting to cluster ${payload.cluster} as ${user.identityId} \r\n`,
      );

      const socket = new WebSocket(
        (location.protocol === "http:" ? "ws" : "wss") + "://" + location.host +
        join(BASE_PATH, "/api/jobShell") + "?" + new URLSearchParams(payload).toString(),
      );

      socket.onopen = () => {
        term.clear();

        const send = (data: ShellInputData) => {
          socket.send(JSON.stringify(data));
        };

        const resizeObserver = new ResizeObserver(debounce(() => {
          fitAddon.fit();
          send({ $case: "resize", resize: { cols: term.cols, rows: term.rows } });
        }));

        resizeObserver.observe(container.current!);

        term.onData((data) => {
          send({ $case: "data", data: { data } });
        });
      };



      socket.onmessage = (e) => {
        const message = JSON.parse(e.data) as ShellOutputData;
        switch (message.$case) {
        case "data":
          const data = Buffer.from(message.data.data);
          term.write(data);
          break;
        case "exit":
          term.write(`Process exited with code ${message.exit.code} and signal ${message.exit.signal}.`);
          break;
        }
      };

      return () => { 
        if (socket) socket.close();
        if (term) term.dispose();
        terminalInitialized.current = false;
      };
    }
  }, [container.current]);

  return (
    <TerminalContainer ref={container} />
  );
};

