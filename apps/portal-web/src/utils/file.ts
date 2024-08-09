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

import { CloseOutlined, FileOutlined, FolderOutlined } from "@ant-design/icons";
import * as crypto from "crypto";
import { join } from "path";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { FileInfo, FileType } from "src/pages/api/file/list";
import { styled } from "styled-components";

export type FileInfoKey = React.Key;

export const fileInfoKey = (f: FileInfo, path: string): FileInfoKey => join(path, f.name);

export const TopBar = styled(FilterFormContainer)`
  display: flex;
  flex-direction: row;
  padding-bottom: 8px;
  &>button {
    margin: 0px 4px;
  }
`;

export const fileTypeIcons = {
  "FILE": FileOutlined,
  "DIR": FolderOutlined,
  "ERROR": CloseOutlined,
} as Record<FileType, React.ComponentType>;

export const nodeModeToString = (mode: number) => {
  const numberPermission = (mode & parseInt("777", 8)).toString(8);

  const toStr = (char: string) => {
    const num = +char;
    return ((num & 4) !== 0 ? "r" : "-") + ((num & 2) !== 0 ? "w" : "-") + ((num & 1) !== 0 ? "x" : "-");
  };

  return [0, 1, 2].reduce((prev, curr) => prev + toStr(numberPermission[curr]), "");
};

export const openPreviewLink = (href: string) => {
  window.open(href, "ViewFile", "location=yes,resizable=yes,scrollbars=yes,status=yes");
};

export async function calculateBlobSHA256(blob: Blob): Promise<string> {

  try {

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const hash = crypto.createHash("sha256");
    hash.update(buffer);
    const hashHex = hash.digest("hex");

    return hashHex;
  } catch (error) {

    throw new Error(`Failed to calculate hash: ${error.message}`);
  }
}

