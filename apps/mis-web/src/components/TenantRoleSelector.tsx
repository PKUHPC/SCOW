import { App, Select, Tooltip } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { User } from "src/stores/UserStore";

interface Props {
  roles: TenantRole[];
  userId: string;
  reload: () => void;
  currentUser?: User;
  isDisabled?: boolean;
}

const p = prefix("component.others.");

export const TenantRoleSelector: React.FC<Props> = ({ roles, userId, reload, currentUser, isDisabled = false }) => {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);

  const t = useI18nTranslateToString();

  const TenantRoleI18nTexts = {
    [TenantRole.TENANT_FINANCE]: t("userRoles.tenantFinance"),
    [TenantRole.TENANT_ADMIN]: t("userRoles.tenantAdmin"),
  };

  return (
    <Tooltip title={isDisabled ? t("component.deleteModals.userDeleted") : ""}>
      <Select
        disabled={isDisabled || loading}
        value={roles}
        style={{ width: "100%" }}
        options={Object.values(TenantRole).map((x) => ({ label: TenantRoleI18nTexts[x], value: x }))}
        onSelect={async (value) => {
          setLoading(true);
          await api
            .setTenantRole({
              body: {
                userId: userId,
                roleType: value,
              },
            })
            .httpError(200, () => {
              message.error(t(p("alreadyIs")));
            })
            .httpError(404, () => {
              message.error(t(p("notExist")));
            })
            .httpError(403, () => {
              message.error(t(p("notAuth")));
            })
            .then(() => {
              message.success(t(p("setSuccess")));
              setLoading(false);
              reload();
            });
        }}
        onDeselect={async (value) => {
          if (currentUser && value === TenantRole.TENANT_ADMIN && currentUser.identityId === userId) {
            message.error(t(p("cannotCancel")));
            return;
          }

          setLoading(true);
          await api
            .unsetTenantRole({
              body: {
                userId: userId,
                roleType: value,
              },
            })
            .httpError(200, () => {
              message.error(t(p("alreadyNot")));
            })
            .httpError(404, () => {
              message.error(t(p("notExist")));
            })
            .httpError(403, () => {
              message.error(t(p("notAuth")));
            })
            .then(() => {
              message.success(t(p("setSuccess")));
              setLoading(false);
              reload();
            });
        }}
        mode="multiple"
        placeholder={t(p("selectRole"))}
      />
    </Tooltip>
  );
};
