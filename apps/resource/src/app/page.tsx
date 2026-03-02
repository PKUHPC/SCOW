"use client";

import { Result } from "antd";

export default function Home() {

  return (
    <Result
      status="403"
      title="Not Found Page"
      subTitle="Accessible only through the main system."
    />
  );
}
