"use client";

import { ReloadOutlined } from "@ant-design/icons";
import { Button, Select, Space, Tooltip } from "antd";
import { useEffect } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { trpc } from "src/utils/trpc";

interface Props {
  cluster?: string;
  value?: string;
  onChange?: (value: string) => void;
  onReload?: () => void;
}

export const AccountSelector: React.FC<Props> = ({ cluster, onChange, value, onReload }) => {
  const t = useI18nTranslateToString();
  const p = prefix("component.accountSelector.");

  const { data, isLoading, refetch } = trpc.account.listAccounts.useQuery({ clusterId: cluster });

  useEffect(() => {

    if (data?.accounts.length) {
      if (!value || !data.accounts.includes(value)) {
        onChange?.(data.accounts[0]);
      }
    }
  }, [data, value]);

  return (
    <Space.Compact style={{ width: "100%" }}>
      <Select
        loading={isLoading}
        options={data ? data.accounts.map((x) => ({ label: x, value: x })) : []}
        placeholder={t(p("select"))}
        value={value}
        style={{ width: "calc(100% - 32px)" }}
        onChange={(v) => onChange?.(v)}
      />
      <Tooltip title={t(p("refresh"))}>
        <Button
          icon={<ReloadOutlined spin={isLoading} />}
          onClick={() => {
            refetch();
            onReload?.();
          }}
          loading={isLoading}
        />
      </Tooltip>
    </Space.Compact>
  );
};

