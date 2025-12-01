import { Alert, Card } from "antd";
import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { ShellCardList } from "src/pageComponents/admin/ShellCardList";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

const p = prefix("page.admin.shell.");

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const BigCard = styled(Card)`
  flex: 1;
  display: flex;
  flex-direction: column;
  .ant-card-head {
    border-bottom: none;
    padding: 16px 24px 0;
  }
  .ant-card-body {
    overflow: auto;
  }
`;

export const ImportUsersPage: NextPage = requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(
  () => {
    const t = useI18nTranslateToString();
    return (
      <div>
        <Head title={t(p("shell"))} />
        <PageTitle titleText={t(p("shell"))} />
        <PageContainer>
          <Alert
            type="info"
            style={{ marginBottom: "4px" }}
            showIcon
            message={(
              <>
                <div>
                  {t("page.admin.shell.alertInfo")}
                </div>
              </>
            )}
          />
          <BigCard>
            <ShellCardList />
          </BigCard>
        </PageContainer>

      </div>
    );
  });

export default ImportUsersPage;


