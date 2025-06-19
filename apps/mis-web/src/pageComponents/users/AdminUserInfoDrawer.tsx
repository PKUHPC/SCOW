import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { Descriptions, Drawer, Tag } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { PlatformUserInfo } from "src/models/UserSchemaModel";

interface Props {
  open: boolean;
  item: Partial<PlatformUserInfo> | undefined;
  onClose: () => void;
}

const p = prefix("pageComp.user.adminUserInfoDrawer.");

export const AdminUserInfoDrawer: React.FC<Props> = (props) => {

  const t = useI18nTranslateToString();

  const PlatformRoleI18nTexts = {
    [PlatformRole.PLATFORM_FINANCE]: t("userRoles.platformFinance"),
    [PlatformRole.PLATFORM_ADMIN]: t("userRoles.platformAdmin"),
  };

  const formatPlatformRoles = (platformRoles?: (1 | 0)[]) => {
    if (!platformRoles) return "";

    return platformRoles.map((role) => (
      <Tag key={role}>{PlatformRoleI18nTexts[role]}</Tag>
    ));
  };

  const formatAccount = (accounts?: string[]) => {
    if (!accounts || accounts.length === 0) return "";

    return accounts.join(", ");
  };

  const drawerItems = [
    [t(p("id")), "id"],
    [t(p("name")), "name"],
    [t(p("email")), "email"],
    [t(p("phone")), "phone"],
    [t(p("organization")), "organization"],
    [t(p("tenant")), "tenant"],
    [t(p("platformRoles")), "platformRoles", formatPlatformRoles],
    [t(p("availableAccounts")), "availableAccounts", formatAccount],
    [t(p("comment")), "adminComment"],
    [t(p("createTime")), "createTime", formatDateTime],
  ] as (
  | [string, keyof PlatformUserInfo, (v: any) => string]
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
              <Descriptions.Item key={item.userId} label={label}>
                {format ? format(item[key]) : (item[key] ?? "") as string}
              </Descriptions.Item>
            ))).filter((x) => x)}
          </Descriptions>
        ) : undefined }
    </Drawer>
  );
};
