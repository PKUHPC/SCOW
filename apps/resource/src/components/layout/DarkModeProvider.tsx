"use client";

import { ConfigProvider, theme } from "antd";
import { PropsWithChildren, useContext } from "react";
import { ScowParamsContext } from "src/components/ScowParamsProvider";

export const DarkModeProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {

  const { scowDark } = useContext(ScowParamsContext);

  return (
    <ConfigProvider theme={{
      algorithm: scowDark ? theme.darkAlgorithm : undefined,
    }}
    >
      {children}
    </ConfigProvider>
  );
};
