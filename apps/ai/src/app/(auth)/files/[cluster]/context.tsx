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

"use client";
import React, { Dispatch, SetStateAction, useContext } from "react";
import { FileInfo, FileType } from "src/models/File";


export type TableFileInfo = Omit<FileInfo, "type"> & { type: FileType };

export interface Operation {
  op: "copy" | "move";
  originalPath: string
  started: boolean;
  selected: TableFileInfo[];
  completed: TableFileInfo[];
}

export const OperationContext = React.createContext<{
  operation: Operation | undefined,
  setOperation: Dispatch<SetStateAction<Operation | undefined>>;
}>(undefined!);

export const useOperation = () => {
  return useContext(OperationContext);
};
