"use client";

import { Col, Row } from "antd";
import React from "react";
import { styled } from "styled-components";

const GridWrap = styled.div`
  /* 补偿 Row 的 -6px 负外边距（12 / 2） */
  padding: 0 6px;
  overflow-x: hidden;
`;

const FrameContainer = styled.div`
  display: flex;
  width: 100%;
  height: 300px;
`;

const IFrame = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
`;

interface Props {
  sources: string[];
}

export function MonitorGrid({ sources }: Props) {
  return (
    <GridWrap>
      <Row gutter={[12, 12]}>
        {sources.map((src) => (
          <Col key={src} span={12} style={{ paddingLeft: 0 }}>
            <FrameContainer>
              <IFrame src={src} />
            </FrameContainer>
          </Col>
        ))}
      </Row>
    </GridWrap>
  );
}
