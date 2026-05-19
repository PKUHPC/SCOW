import { Spin } from "antd";
import { max } from "d3-array";
import React from "react";
import { Localized } from "src/i18n";
import { DeviceDetailInfo } from "src/models/device";
import { LayoutVis } from "src/pageComponents/chip/LayoutVis";
import { getLayoutMap, rotateLayoutAndScaleIfOdd45 } from "src/utils/chip";

export const LayoutVisContainer: React.FC<{ deviceInfo?: DeviceDetailInfo; offsetDegree: number }> = ({
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

  const linksData = deviceInfo?.links?.map((l) => [l.A, l.B]) ?? [];

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

  // 定义最小字体大小
  const MIN_FONT_SIZE = 8;
  // 定义字体大小与节点大小的比例关系
  const FONT_SIZE_TO_NODE_SIZE_RATIO = 6;

  // 1. 计算正常尺寸
  const chartTwoColWidth = parentWidth / 4 - 64;
  const calculatedNodeSize = (chartTwoColWidth / (maxX + 1) - NODE_GAP) * 0.9;
  const calculatedFontSize = Math.min(16, calculatedNodeSize / FONT_SIZE_TO_NODE_SIZE_RATIO);

  let nodeSize: number;
  let fontSize: number;
  let isActualOverflow: boolean = false; // 宽度超限判断

  // 2. 判断字体是否过小
  if (calculatedFontSize < MIN_FONT_SIZE) {
    fontSize = MIN_FONT_SIZE;
    nodeSize = fontSize * FONT_SIZE_TO_NODE_SIZE_RATIO;

    // 在全宽模式下，检查是否仍然超出父容器
    // 计算单张图的实际宽度（节点尺寸使用全宽模式下的尺寸）
    const actualChartWidth = Math.max(maxX + 1, maxY + 1) * (nodeSize * 1.2 + NODE_GAP);
    if (actualChartWidth > parentWidth / 2) {
      isActualOverflow = true;
    }
  } else {
    nodeSize = calculatedNodeSize;
    fontSize = calculatedFontSize;
    isActualOverflow = false;
  }

  return (
    <LayoutVis
      linksData={linksData}
      coords={coords}
      maxX={maxX}
      maxY={maxY}
      nodeSize={nodeSize}
      fontSize={fontSize}
      isFullWidth={isActualOverflow}
    />
  );
};

export default LayoutVisContainer;
