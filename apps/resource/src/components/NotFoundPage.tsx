"use client";

import { Result } from "antd";

import { Head } from "./head";

export const NotFoundPage = () => {
  return (
    <>
      <Head title="Not Found" />
      <Result status="404" title={"404"} subTitle={"Not Found Page"} />
    </>
  );
};
