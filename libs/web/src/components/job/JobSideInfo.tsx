import React from "react";
import { styled } from "styled-components";

import { JobSidePanelInfoBox, SidePanelLabel, SidePanelRow, SidePanelValue } from "../../layouts/base/JobContainer";

export interface JobSideInfoAccountInfo {
  accountName: string;
  isInWhitelist?: boolean;
  ownerName?: string;
  ownerId?: string;
  balance: number;
  blockThresholdAmount: number;
  jobChargeLimit?: number;
  usedJobCharge?: number;
}

export interface JobSideInfoLabels {
  totalNodeCount: string;
  totalGpuCount: string;
  totalCoreCount: string;
  totalMemory: string;
  costPerHour: string;
  pricingStandard: string;
  yuan: string;
  hours: string;
  accountNameLabel: string;
  whitelistTag: string;
  accountOwner: string;
  accountBalance: string;
  accountBlockThreshold: string;
  userUsedLimit: string;
  userChargeNoLimit: string;
}

export interface JobSideInfoProps {
  labels: JobSideInfoLabels;
  nodeCount?: number;
  totalGpuCount: number | string;
  totalCpuCount: number | string;
  totalMemory: string;
  hourlyPrice: string;
  showHourlyPriceUnit: boolean;
  pricingStandardUrl: string;
  showAccountInfo: boolean;
  accountInfo?: JobSideInfoAccountInfo | null;
}

const Divider = styled.div`
  width: 100%;
  height: 1px;
  background: ${({ theme }) => theme.palette.gray[3]};
`;

const UnitText = styled.span`
  color: ${({ theme }) => theme.palette.gray[8]};
`;

const PlainValue = styled(SidePanelValue)`
  color: ${({ theme }) => theme.palette.gray[8]};
`;

const WhitelistTag = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 18px;
  border: 1px solid ${({ theme }) => theme.token.colorPrimary};
  border-radius: 6px;
  color: ${({ theme }) => theme.token.colorPrimary};
  font-size: 14px;
  font-weight: 500;
`;

const Amount: React.FC<{ value: number; unit: string }> = ({ value, unit }) => (
  <>
    {value.toFixed(2)} <UnitText>{unit}</UnitText>
  </>
);

export const JobSideInfo: React.FC<JobSideInfoProps> = ({
  labels,
  nodeCount,
  totalGpuCount,
  totalCpuCount,
  totalMemory,
  hourlyPrice,
  showHourlyPriceUnit,
  pricingStandardUrl,
  showAccountInfo,
  accountInfo,
}) => {
  const memParts = totalMemory !== "-" ? totalMemory.split(" ") : null;

  return (
    <JobSidePanelInfoBox>
      <SidePanelRow>
        <SidePanelLabel>{labels.totalNodeCount}</SidePanelLabel>
        <SidePanelValue>{nodeCount ?? "-"}</SidePanelValue>
      </SidePanelRow>
      <SidePanelRow>
        <SidePanelLabel>{labels.totalGpuCount}</SidePanelLabel>
        <SidePanelValue>{totalGpuCount}</SidePanelValue>
      </SidePanelRow>
      <SidePanelRow>
        <SidePanelLabel>{labels.totalCoreCount}</SidePanelLabel>
        <SidePanelValue>{totalCpuCount}</SidePanelValue>
      </SidePanelRow>
      <SidePanelRow>
        <SidePanelLabel>{labels.totalMemory}</SidePanelLabel>
        <SidePanelValue>
          {memParts ? (
            <>
              {memParts[0]} <UnitText>{memParts.slice(1).join(" ")}</UnitText>
            </>
          ) : (
            "-"
          )}
        </SidePanelValue>
      </SidePanelRow>
      <SidePanelRow>
        <SidePanelLabel>{labels.costPerHour}</SidePanelLabel>
        <SidePanelValue>
          {hourlyPrice}
          {showHourlyPriceUnit && (
            <UnitText>
              {" "}
              {labels.yuan}/{labels.hours}
            </UnitText>
          )}
          <a
            style={{ marginLeft: 16 }}
            onClick={() => window.open(pricingStandardUrl, "_blank", "noopener,noreferrer")}
          >
            {labels.pricingStandard}
          </a>
        </SidePanelValue>
      </SidePanelRow>
      {showAccountInfo && (
        <>
          <Divider />
          <SidePanelRow>
            <SidePanelLabel>{labels.accountNameLabel}</SidePanelLabel>
            <PlainValue>
              <span style={{ marginRight: 20 }}>{accountInfo?.accountName ?? "-"}</span>
              {accountInfo?.isInWhitelist && <WhitelistTag>{labels.whitelistTag}</WhitelistTag>}
            </PlainValue>
          </SidePanelRow>
          <SidePanelRow>
            <SidePanelLabel>{labels.accountOwner}</SidePanelLabel>
            <PlainValue>
              {accountInfo?.ownerName ?? "-"}
              {accountInfo?.ownerId ? ` (ID: ${accountInfo.ownerId})` : ""}
            </PlainValue>
          </SidePanelRow>
          <SidePanelRow>
            <SidePanelLabel>{labels.accountBalance}</SidePanelLabel>
            <SidePanelValue>
              {accountInfo ? <Amount value={accountInfo.balance} unit={labels.yuan} /> : "-"}
            </SidePanelValue>
          </SidePanelRow>
          <SidePanelRow>
            <SidePanelLabel>{labels.accountBlockThreshold}</SidePanelLabel>
            <SidePanelValue>
              {accountInfo ? <Amount value={accountInfo.blockThresholdAmount} unit={labels.yuan} /> : "-"}
            </SidePanelValue>
          </SidePanelRow>
          <SidePanelRow>
            <SidePanelLabel>{labels.userUsedLimit}</SidePanelLabel>
            <SidePanelValue>
              {accountInfo ? (
                <>
                  {accountInfo.usedJobCharge !== undefined ? accountInfo.usedJobCharge.toFixed(2) : "-"}/
                  {accountInfo.jobChargeLimit !== undefined
                    ? accountInfo.jobChargeLimit.toFixed(2)
                    : labels.userChargeNoLimit}
                  {accountInfo.jobChargeLimit !== undefined && (
                    <>
                      {" "}
                      <UnitText>{labels.yuan}</UnitText>
                    </>
                  )}
                </>
              ) : (
                "-"
              )}
            </SidePanelValue>
          </SidePanelRow>
        </>
      )}
    </JobSidePanelInfoBox>
  );
};
