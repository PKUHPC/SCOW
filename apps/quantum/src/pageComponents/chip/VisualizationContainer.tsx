import { Spin } from "antd";
import { max } from "d3-array";
import React from "react";
import { Localized } from "src/i18n";
import { CZGateData, DeviceDetailInfo, QubitData } from "src/models/device";
import { CZGateFidelityMap } from "src/pageComponents/chip/CZGateFidelityMap";
import { SingleQubitFidelityMap } from "src/pageComponents/chip/SingleQubitFidelityMap";
import { getLayoutMap, rotateLayoutAndScaleIfOdd45, swapQubitData } from "src/utils/chip";

export const VisualizationContainer: React.FC<{ deviceInfo?: DeviceDetailInfo; offsetDegree: number }> = ({
  deviceInfo,
  offsetDegree,
}) => {
  if (!deviceInfo) {
    return (
      <Spin>
        <Localized id="common.loading" />
      </Spin>
    );
  }

  const initialSingleQubits: QubitData[] =
    deviceInfo?.bits?.map((b) => ({
      Q: b.Qubit,
      Err: { SQ: b.SingleQubitErrRate },
    })) ?? [];

  const initialCzData: CZGateData[] =
    deviceInfo?.links?.map((l) => ({
      Q: [l.A, l.B],
      Fidelity: 1 - (l.CZErrRate ?? 0),
    })) ?? [];

  const swapList = deviceInfo.layout?.swap ?? [];
  const singleQubits = swapQubitData(initialSingleQubits, swapList);
  const czData = swapQubitData(initialCzData, swapList);

  const layout = deviceInfo?.layout;

  if (!layout) {
    return <></>;
  }

  const coords2 = getLayoutMap(layout);
  const coords = rotateLayoutAndScaleIfOdd45(coords2, offsetDegree);

  const xs = Object.values(coords).map((p) => p.x);
  const ys = Object.values(coords).map((p) => p.y);
  const maxX = max(xs) ?? 0;
  const maxY = max(ys) ?? 0;

  const parentWidth = window.innerWidth - 128; // 父容器总宽度
  const NODE_GAP = 0;

  // 计算布局分布

  // 定义最小字体大小
  const MIN_FONT_SIZE = 10;
  // 定义字体大小与节点大小的比例关系
  const FONT_SIZE_TO_NODE_SIZE_RATIO = 6;

  // 1. 先尝试在两列布局下计算尺寸
  const chartTwoColWidth = parentWidth / 2 - 32;
  const calculatedNodeSize = (chartTwoColWidth / (maxX + 1) - NODE_GAP) * 0.9;
  const calculatedFontSize = Math.min(16, calculatedNodeSize / FONT_SIZE_TO_NODE_SIZE_RATIO);

  let nodeSize: number;
  let fontSize: number;
  let isFullWidth: boolean;
  let isActualOverflow: boolean = false; // 宽度超限判断

  // 2. 判断字体是否过小
  if (calculatedFontSize < MIN_FONT_SIZE) {
    isFullWidth = true;
    fontSize = MIN_FONT_SIZE;
    nodeSize = fontSize * FONT_SIZE_TO_NODE_SIZE_RATIO;

    // 在全宽模式下，检查是否仍然超出父容器
    // 计算单张图的实际宽度（节点尺寸使用全宽模式下的尺寸）
    const actualChartWidth = (maxX + 1) * (nodeSize * 1.2 + NODE_GAP);
    if (actualChartWidth > parentWidth) {
      isActualOverflow = true;
    }
  } else {
    isFullWidth = false;
    nodeSize = calculatedNodeSize;
    fontSize = calculatedFontSize;
    isActualOverflow = false;
  }

  // 根据 isFullWidth 设置 CSS
  const columns = isFullWidth ? "max-content" : "1fr 1fr";
  const rowGap = isFullWidth ? 24 : 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns,
        columnGap: 24,
        rowGap: rowGap,
        alignItems: "start",
        justifyContent: isFullWidth ? "center" : "start",
      }}
    >
      <SingleQubitFidelityMap
        qubits={singleQubits}
        coords={coords}
        maxX={maxX}
        maxY={maxY}
        isFullWidth={isFullWidth}
        nodeSize={nodeSize}
        fontSize={fontSize}
        legendBelowChart={isActualOverflow}
      />
      <CZGateFidelityMap
        cz={czData}
        coords={coords}
        maxX={maxX}
        maxY={maxY}
        isFullWidth={isFullWidth}
        nodeSize={nodeSize}
        fontSize={fontSize}
        legendBelowChart={isActualOverflow}
        offsetDegree={offsetDegree}
      />
    </div>
  );
};

export default VisualizationContainer;
