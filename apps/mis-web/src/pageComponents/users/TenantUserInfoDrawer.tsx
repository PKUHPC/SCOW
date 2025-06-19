import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { Descriptions, Drawer, Tag } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { AccountAffiliation,FullUserInfo, TenantRole } from "src/models/User";

interface Props {
  open: boolean;
  item: Partial<FullUserInfo> | undefined;
  onClose: () => void;
}

const p = prefix("pageComp.user.tenantUserInfoDrawer.");

export const TenantUserInfoDrawer: React.FC<Props> = (props) => {

  const t = useI18nTranslateToString();

  const TenantRoleI18nTexts = {
    [TenantRole.TENANT_FINANCE]: t("userRoles.tenantFinance"),
    [TenantRole.TENANT_ADMIN]: t("userRoles.tenantAdmin"),
  };

  const formatTenantRoles = (tenantRoles?: (0 | 1)[]) => {
    if (!tenantRoles) return "";

    return tenantRoles.map((role) => (
      <Tag key={role}>{TenantRoleI18nTexts[role]}</Tag>
    ));
  };

  const formatAccount = (accounts?: AccountAffiliation[]) => {
    if (!accounts) return "";

    return accounts.map((a) => a.accountName).join(", ");
  };

  const drawerItems = [
    [t(p("id")), "id"],
    [t(p("name")), "name"],
    [t(p("email")), "email"],
    [t(p("phone")), "phone"],
    [t(p("organization")), "organization"],
    [t(p("tenantRoles")), "tenantRoles", formatTenantRoles],
    [t(p("affiliatedAccounts")), "accountAffiliations", formatAccount],
    [t(p("comment")), "adminComment"],
    [t(p("createTime")), "createTime", formatDateTime],
  ] as (
  | [string, keyof FullUserInfo, (v: any) => string]
  )[];


  const { item, onClose, open } = props;

  return (
    <Drawer
      width={500}
      placement="right"
      onClose={onClose}
      open={open}
      title={t(p("detail"))}
    >
      {
        item ? (
          <Descriptions
            column={1}
            bordered
            size="small"
          >
            {drawerItems.map((([label, key, format]) => (
              <Descriptions.Item key={item.id} label={label}>
                {format ? format(item[key]) : (item[key] ?? "") as string}
              </Descriptions.Item>
            ))).filter((x) => x)}
          </Descriptions>
        ) : undefined }
    </Drawer>
  );
};
