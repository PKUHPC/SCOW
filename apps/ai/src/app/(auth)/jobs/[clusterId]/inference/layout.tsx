"use client";

import React from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { ForbiddenPage } from "src/layouts/error/ForbiddenPage";


export default function Layout({ children }: { children: React.ReactNode }) {

  const { publicConfig } = usePublicConfig();
  if (!publicConfig.INFER_ENABLED) {
    return <ForbiddenPage />;
  }

  return children;
}


