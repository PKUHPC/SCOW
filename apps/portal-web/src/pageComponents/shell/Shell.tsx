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
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { join } from "path";
import { useEffect, useRef } from "react";
import { urlToDownload } from "src/pageComponents/filemanager/api";
import { ShellInputData, ShellOutputData } from "src/server/setup/shell";
import { User } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";
import { styled } from "styled-components";

const TerminalContainer = styled.div`
  background-color: black;
  flex: 1;

  width: 100%;
`;

interface Props {
  user: User;
  cluster: string;
  loginNode: string
  path: string;
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


export const Shell: React.FC<Props> = ({ user, cluster, loginNode, path }) => {

  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current) {
      const term = new Terminal({
        cursorBlink: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container.current);

      const payload = {
        cluster,
        loginNode,
        path,
        cols: term.cols + "",
        rows: term.rows + "",
      };

      term.write(
        `\r\n*** Connecting to cluster ${payload.cluster} as ${user.identityId} to ` +
        `${path ? "path " + path : "home path"} ***\r\n`,
      );

      const socket = new WebSocket(
        (location.protocol === "http:" ? "ws" : "wss") + "://" + location.host +
        join(publicConfig.BASE_PATH, "/api/shell") + "?" + new URLSearchParams(payload).toString(),
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

        term.onResize(({ cols, rows }) => {
          send({ $case: "resize", resize: { cols, rows } });
        });
      };



      socket.onmessage = (e) => {
        const message = JSON.parse(e.data) as ShellOutputData;
        switch (message.$case) {
          case "data": {
            const data = Buffer.from(message.data.data);

            const dataString = data.toString();
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
            term.write(Uint8Array.from(data));

            break;
          }
          case "exit":
            term.write(`Process exited with code ${message.exit.code} and signal ${message.exit.signal}.`);
            break;
        }
      };

      return () => {
        socket.close();
        term.dispose();
      };
    }
  }, [container.current]);

  return (
    <TerminalContainer ref={container} />
  );
};

