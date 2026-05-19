import { App, Select, Tooltip } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { User } from "src/stores/UserStore";

interface Props {
  roles: PlatformRole[];
  userId: string;
  reload: () => void;
  currentUser?: User;
  isDisabled?: boolean;
}

const p = prefix("component.others.");

export const PlatformRoleSelector: React.FC<Props> = ({ roles, userId, reload, currentUser, isDisabled = false }) => {
  const t = useI18nTranslateToString();

  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);

  const PlatformRoleI18nTexts = {
    [PlatformRole.PLATFORM_FINANCE]: t("userRoles.platformFinance"),
    [PlatformRole.PLATFORM_ADMIN]: t("userRoles.platformAdmin"),
  };

  return (
    <Tooltip title={isDisabled ? t("component.deleteModals.userDeleted") : ""}>
      <Select
        disabled={isDisabled || loading}
        value={roles}
        style={{ width: "100%" }}
        options={Object.values(PlatformRole).map((x) => ({ label: PlatformRoleI18nTexts[x], value: x }))}
        onSelect={async (value) => {
          setLoading(true);
          await api
            .setPlatformRole({
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
          if (currentUser && value === PlatformRole.PLATFORM_ADMIN && currentUser.identityId === userId) {
            message.error(t(p("cannotCancel")));
            return;
          }

          setLoading(true);
          await api
            .unsetPlatformRole({
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
