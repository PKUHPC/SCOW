import { ReloadOutlined } from "@ant-design/icons";
import { Button, Select, Space, Tooltip } from "antd";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { UserStore } from "src/stores/UserStore";

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * if true, the first tenant will be selected automatically when tenants are fetched
   */
  autoSelect?: boolean;

  /**
   * Called when tenants are fetched
   * @param tenants all tenants
   */
  onTenantsFetched?: (tenants: string[]) => void;
  allowClear?: boolean;
}
const p = prefix("pageComp.tenant.tenantSelector.");

export const TenantSelector: React.FC<Props> = ({
  onChange,
  value,
  placeholder,
  disabled,
  autoSelect,
  onTenantsFetched,
  allowClear = true,
}) => {
  const t = useI18nTranslateToString();

  const userStore = useStore(UserStore);

  const promiseFn = useCallback(async () => {
    return api.getTenants({ query: {} });
  }, [userStore.user]);

  const { data, isLoading, reload } = useAsync({
    promiseFn,
    onResolve(data) {
      onTenantsFetched?.(data.names);
      if (autoSelect && !value && data.names.length > 0) {
        onChange?.(data.names[0]);
      }
    },
  });

  return (
    <Space.Compact style={{ width: "100%" }}>
      <Select
        showSearch
        loading={isLoading}
        options={data ? data.names.map((x) => ({ label: x, value: x })) : []}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        style={{ width: "calc(100% - 32px)", minWidth: "200px" }}
        onChange={(v) => onChange?.(v)}
        allowClear={allowClear}
      />
      <Tooltip title={t(p("fresh"))}>
        <Button icon={<ReloadOutlined spin={isLoading} />} disabled={disabled} onClick={reload} loading={isLoading} />
      </Tooltip>
    </Space.Compact>
  );
};
