/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { ReloadOutlined } from "@ant-design/icons";
import { Button, Input, Select, Tooltip } from "antd";
import { useEffect } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";

interface Props {
  selectableAccounts: string[];
  isLoading: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onReload?: () => void;
}

export const AccountListSelector: React.FC<Props> = ({ selectableAccounts, isLoading,
  onChange, value, onReload }) => {

  useEffect(() => {
    if (selectableAccounts.length && !value) {
      onChange?.(selectableAccounts[0]);
    }
  }, [selectableAccounts, value]);

  const t = useI18nTranslateToString();
  const p = prefix("pageComp.job.accountSelector.");

  return (
    <Input.Group compact>
      <Select
        loading={isLoading}
        options={selectableAccounts ? selectableAccounts.map((x) => ({ label: x, value: x })) : []}
        placeholder={t(p("selectAccountPlaceholder"))}
        value={value}
        style={{ width: "calc(100% - 32px)" }}
        onChange={(v) => onChange?.(v)}
      />
      <Tooltip title={t(p("refreshAccountList"))}>
        <Button icon={<ReloadOutlined spin={isLoading} />} onClick={() => onReload?.()} loading={isLoading} />
      </Tooltip>
    </Input.Group>
  );
};

