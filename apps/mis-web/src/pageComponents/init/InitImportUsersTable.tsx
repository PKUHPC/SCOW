import { Alert, Typography } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { styled } from "styled-components";

import { ImportUsersTable } from "../admin/ImportUsersTable";

const AlertContainer = styled.div`
  margin-bottom: 16px;
`;

const p = prefix("pageComp.init.initImportUsersTable.");

export const InitImportUsersTable: React.FC = () => {
  const t = useI18nTranslateToString();

  return (
    <div>
      <Typography.Paragraph>
        {t(p("importUser"))}
        <a target="_blank" href="https://pkuhpc.github.io/SCOW/docs/mis/business/users" rel="noreferrer">
          {t(p("document"))}
        </a>
        {t(p("learn"))}
      </Typography.Paragraph>
      <AlertContainer>
        <Alert type="warning" showIcon message={t(p("useMore"))} />
      </AlertContainer>
      <ImportUsersTable />
    </div>
  );
};
