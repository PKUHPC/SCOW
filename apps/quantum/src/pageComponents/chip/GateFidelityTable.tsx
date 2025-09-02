import { Typography } from "antd";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { AveragesState, DeviceDetailInfo } from "src/models/device";
import { styled } from "styled-components";

const StyledTable = styled.table`
  border-collapse: collapse;
  width: 100%;
  text-align: left;

  th, td {
    padding: 8px;
    border: 1px solid #e0e0e0;
  }

  th:first-child, td:first-child {
    text-align: right;
  }

  th:nth-child(even), td:nth-child(even) {
    background-color: #f0f2f5;
  }
`;

type LinkKey = "A" | "B" | "CZErrRate" | "GateLenInNs";

export const GateFidelityTable = ({
  deviceInfo,
  averages,
}: {
  deviceInfo?: DeviceDetailInfo;
  averages: AveragesState;
}) => {

  const { Text } = Typography;

  const t = useI18nTranslateToString();
  const p = prefix("page.chip.");

  const renderRow = (label: string, avg: string | number, key: string, precision?: number) => (
    <tr>
      <td style={{ fontWeight: "700" }}>{label}</td>
      <td>{avg}</td>
      {deviceInfo?.bits?.map((bit, idx) => (
        <td key={idx}>{precision ? bit[key]?.toFixed(precision) : bit[key]}</td>
      ))}
    </tr>
  );

  const renderCZRow = (label: string, avg: string | number, key: LinkKey, precision?: number) => (
    <tr>
      <td style={{ fontWeight: "700" }}>{label}</td>
      <td>{avg}</td>
      {deviceInfo?.links?.map((link, idx) => (
        <td key={idx}>{precision ? link[key]?.toFixed(precision) : link[key]}</td>
      ))}
    </tr>
  );

  return (
    <>
      <div style={{ marginBottom: "12px" }}>
        <Text>{t(p("dataTable"))}</Text>
      </div>
      {/* 单比特表格 */}
      <div style={{ overflowX: "auto" }}>
        <StyledTable>
          <thead>
            <tr>
              <th></th>
              <th>AVG</th>
              {deviceInfo?.bits?.map((bit) => <th key={bit.Qubit}>Q{bit.Qubit}</th>)}
            </tr>
          </thead>
          <tbody>
            {renderRow("T1 (μs)", averages.t1Avg, "T1")}
            {renderRow("T2 (μs)", averages.t2Avg, "T2")}
            {renderRow("SQ.Err", averages.sqErrAvg, "SingleQubitErrRate")}
            {renderRow("Readout.F0.Err", averages.f0ErrAvg, "ReadoutF0Err")}
            {renderRow("Readout.F1.Err", averages.f1ErrAvg, "ReadoutF1Err")}
          </tbody>
        </StyledTable>
      </div>

      {/* 双比特表格 */}
      <div style={{ marginTop: 20, overflowX: "auto" }}>
        <StyledTable>
          <thead>
            <tr>
              <th></th>
              <th>AVG</th>
              {deviceInfo?.links?.map((link, i) => <th key={i}>Q{link.A},{link.B}</th>)}
            </tr>
          </thead>
          <tbody>
            {renderCZRow("CZ.Err", averages.czErrAvg, "CZErrRate", 3)}
          </tbody>
        </StyledTable>
      </div>
    </>
  );
};

export default GateFidelityTable;
