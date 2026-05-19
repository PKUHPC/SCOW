"use client";

import NextHead from "next/head";
import React from "react";

type Props = React.PropsWithChildren<{
  title: string;
}>;

export const Head: React.FC<Props> = ({ title, children }) => {
  return (
    <NextHead>
      <title>{`${title} - SCOW`}</title>
      {children}
    </NextHead>
  );
};
