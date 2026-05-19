import type { AccountInfo } from "src/pages/dashboard";

import { LockOutlined, UnlockOutlined } from "@ant-design/icons";
import { moneyToNumber } from "@scow/lib-decimal";
import { Alert, Col, Row, Statistic, StatisticProps } from "antd";
import React from "react";
import { Section } from "src/components/Section";
import { AccountStatCard } from "src/components/StatCard";
import { useI18nTranslateToString } from "src/i18n";
import { AccountState, UserStatus } from "src/models/User";
import { moneyNumberToString } from "src/utils/money";
import { styled } from "styled-components";

interface Props {
  info: Record<string, AccountInfo>;
}

// max-width: calc(100%/2 - 8px); 考虑换行后限制最大宽度
const CardContainer = styled.div`
  flex: 1;
  min-width: 300px;
  margin: 4px;
`;

const Container = styled.div`
  display: flex;
  flex-wrap: wrap;
`;

const Info: React.FC<StatisticProps> = (props) => (
  <Col span={24}>
    <Statistic {...props} />
  </Col>
);

export const AccountInfoSection: React.FC<Props> = ({ info }) => {
  const accounts = Object.entries(info);

  const t = useI18nTranslateToString();

  const statusTexts = {
    blocked: ["red", LockOutlined, "1"],
    normal: ["green", UnlockOutlined, "0"],
  } as const;

  return (
    <Section title={t("dashboard.account.title")}>
      {accounts.length === 0 ? (
        <Alert message={t("dashboard.account.alert")} type="warning" showIcon />
      ) : (
        <Container>
          {accounts
            .filter((accountInfo) => accountInfo[1].accountState !== AccountState.DELETED)
            .map(
              ([
                accountName,
                {
                  accountBlocked,
                  userStatus,
                  balance,
                  jobChargeLimit,
                  usedJobCharge,
                  isInWhitelist,
                  blockThresholdAmount,
                },
              ]) => {
                const isBlocked = accountBlocked || userStatus === UserStatus.BLOCKED;
                const [textColor, Icon, opacity] = isBlocked ? statusTexts.blocked : statusTexts.normal;
                const availableLimit =
                  jobChargeLimit && usedJobCharge
                    ? moneyNumberToString(moneyToNumber(jobChargeLimit) - moneyToNumber(usedJobCharge))
                    : undefined;
                const whitelistCharge = isInWhitelist ? t("dashboard.account.unlimited") : undefined;
                const normalCharge = moneyNumberToString(balance - blockThresholdAmount);
                const showAvailableBalance = availableLimit ?? whitelistCharge ?? normalCharge;
                return (
                  <CardContainer key={accountName}>
                    <AccountStatCard title={`${accountName}`} icon={<Icon style={{ color: textColor, opacity }} />}>
                      <Row style={{ flex: 1, width: "100%" }}>
                        <Info
                          title={t("dashboard.account.balance")}
                          valueStyle={{ color: textColor }}
                          prefix={isBlocked ? "" : <span>￥</span>}
                          value={isBlocked ? "-" : showAvailableBalance}
                        />
                      </Row>
                    </AccountStatCard>
                  </CardContainer>
                );
              },
            )}
        </Container>
      )}
    </Section>
  );
};
