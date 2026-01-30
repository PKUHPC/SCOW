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

import React, { useState } from "react";

import { FileManagerContext,Operation } from "./context";

export default function Layout({ children }: { children: React.ReactNode }) {

  const [operation, setOperation] = useState<Operation | undefined>();
  const [filePrevPath, setFilePrevPath] = useState<string | undefined>();

  return (
    <FileManagerContext.Provider value={{ operation, setOperation, filePrevPath, setFilePrevPath }}>
      {children}
    </FileManagerContext.Provider>
  );

}
