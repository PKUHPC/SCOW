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

import { LockOutlined, UnlockOutlined } from "@ant-design/icons";
import { moneyToNumber } from "@scow/lib-decimal";
import { Alert, Col, Row, Statistic, StatisticProps } from "antd";
import React from "react";
import { Section } from "src/components/Section";
import { AccountStatCard } from "src/components/StatCard";
import { useI18nTranslateToString } from "src/i18n";
import { UserStatus } from "src/models/User";
import type { AccountInfo } from "src/pages/dashboard";
import { publicConfig } from "src/utils/config";
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
      {
        accounts.length === 0 ? (
          <Alert message={t("dashboard.account.alert")} type="warning" showIcon />
        ) : (
          <Container>
            {
              accounts.map(([accountName, {
                accountBlocked, userStatus, balance,
                jobChargeLimit, usedJobCharge, isInWhitelist, blockThresholdAmount,
              }]) => {

                const isBlocked = accountBlocked || userStatus === UserStatus.BLOCKED;
                const [ textColor, Icon, opacity] = isBlocked ? statusTexts.blocked : statusTexts.normal;
                const availableLimit = jobChargeLimit && usedJobCharge
                  ? (moneyToNumber(jobChargeLimit) -
                   moneyToNumber(usedJobCharge)).toFixed(publicConfig.CHARGE_PRECISION) : undefined;
                const whitelistCharge = isInWhitelist ? "不限" : undefined;
                const normalCharge = (balance - blockThresholdAmount).toFixed(publicConfig.CHARGE_PRECISION);
                const showAvailableBalance = availableLimit ?? whitelistCharge ?? normalCharge;
                return (
                  <CardContainer key={accountName}>
                    <AccountStatCard title={`${accountName}`} icon={<Icon style={{ color:textColor, opacity }} />}>
                      <Row style={{ flex: 1, width: "100%" }}>
                        <Info
                          title={t("dashboard.account.balance")}
                          valueStyle={{ color:textColor }}
                          prefix={isBlocked ? "" : <span>￥</span>}
                          value={isBlocked ? "-" : showAvailableBalance}
                        />
                      </Row>
                    </AccountStatCard>
                  </CardContainer>
                );
              })
            }
          </Container>
        )
      }
    </Section>

  );

};
