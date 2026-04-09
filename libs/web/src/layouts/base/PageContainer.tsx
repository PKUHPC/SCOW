import { Space } from "antd";
import { antdBreakpoints } from "src/layouts/base/constants";
import { styled } from "styled-components";

// libs/web/src/layouts/base/BaseLayout.tsx中的padding + margin为 24px
const existingPadding = 24;
export const PageContainer = styled(Space)`
  width: 100%;
  padding-right: calc(160px - ${existingPadding}px);
  padding-left: calc(160px - ${existingPadding}px);

  @media (max-width: ${antdBreakpoints.xl}px) {
    padding-right: calc(96px - ${existingPadding}px);
    padding-left: calc(96px - ${existingPadding}px);
  }

  @media (max-width: ${antdBreakpoints.lg}px) {
    padding-right: calc(56px - ${existingPadding}px);
    padding-left: calc(56px - ${existingPadding}px);
  }
`;
