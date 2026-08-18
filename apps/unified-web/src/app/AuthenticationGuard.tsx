import { Result, Spin } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import { useMetadataQuery } from "src/api/metadata";
import { getLoginPath, useSessionQuery } from "src/api/session";
import { styled } from "styled-components";

const Centered = styled.div`
  min-height: 100vh;
  display: grid;
  place-items: center;
`;

export function AuthenticationGuard() {
  const { t } = useTranslation("common");
  const metadataQuery = useMetadataQuery();
  const sessionQuery = useSessionQuery(metadataQuery.data);
  const unauthenticated = sessionQuery.data?.authenticated === false;

  useEffect(() => {
    if (unauthenticated && metadataQuery.data) window.location.replace(getLoginPath(metadataQuery.data));
  }, [metadataQuery.data, unauthenticated]);

  if (metadataQuery.isLoading || sessionQuery.isLoading || unauthenticated) {
    return (
      <Centered>
        <Spin size="large" />
      </Centered>
    );
  }

  if (metadataQuery.isError || sessionQuery.isError) {
    return (
      <Centered>
        <Result status="error" title={t("bootstrap.sessionFailed", "登录状态检查失败")} />
      </Centered>
    );
  }

  return <Outlet />;
}
