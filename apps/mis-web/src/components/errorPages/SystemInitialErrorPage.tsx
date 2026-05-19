import { Result } from "antd";
import React from "react";
import { Head } from "src/utils/head";

// 不使用国际化组件
// 用于系统启动时渲染失败时的错误页面显示
export const SystemInitialErrorPage: React.FC = () => {
  return (
    <>
      <Head title="Server Error" />
      <Result status={500} title="500" subTitle="Server Error Page" />
    </>
  );
};
