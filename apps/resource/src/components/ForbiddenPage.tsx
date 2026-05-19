"use client";
import { Result } from "antd";
import React from "react";

import { Head } from "./head";

interface Props {
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
}

export const ForbiddenPage: React.FC<Props> = ({ title = "Not Allowed", subTitle = "Not Allowed Page。" }) => {
  return (
    <>
      <Head title="Not Allowed" />
      <Result status="403" title={title} subTitle={subTitle} />
    </>
  );
};
