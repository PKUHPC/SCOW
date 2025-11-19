"use client";
import React, { Dispatch, SetStateAction, useContext } from "react";
import { FileInfo } from "src/models/File";

export interface Operation {
  op: "copy" | "move";
  originalPath: string
  started: boolean;
  selected: FileInfo[];
  completed: FileInfo[];
}

export const OperationContext = React.createContext<{
  operation: Operation | undefined,
  setOperation: Dispatch<SetStateAction<Operation | undefined>>;
}>(undefined!);

export const useOperation = () => {
  return useContext(OperationContext);
};
