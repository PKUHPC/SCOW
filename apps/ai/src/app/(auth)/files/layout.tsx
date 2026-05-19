"use client";

import React, { useState } from "react";

import { FileManagerContext, Operation } from "./context";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [operation, setOperation] = useState<Operation | undefined>();
  const [filePrevPath, setFilePrevPath] = useState<string | undefined>();

  return (
    <FileManagerContext.Provider value={{ operation, setOperation, filePrevPath, setFilePrevPath }}>
      {children}
    </FileManagerContext.Provider>
  );
}
