"use client";

import { Flex, Spin } from "antd";

export const Loading: React.FC = () => {
  return (
    <Flex justify="center" align="center" style={{ height: "100vh" }} vertical>
      <Spin />
    </Flex>
  );
};
