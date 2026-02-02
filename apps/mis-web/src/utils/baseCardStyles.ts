import { Button, Card } from "antd";
import { getTransparentColor } from "src/utils/color";
import { styled } from "styled-components";

// 1. 基础卡片样式 (StyledCard)

export const StyledCard = styled(Card)<{
  $boxShadowColor: string;
}>`
  width: 100%;
  box-shadow: ${(props) => `0px 4px 4px 0px ${getTransparentColor(props.$boxShadowColor, 0.08)}`};
  transition: box-shadow 0.3s ease;
  &:hover {
    box-shadow: ${(props) => `0px 4px 4px 0px ${getTransparentColor(props.$boxShadowColor, 0.2)}`};
  }
  .ant-card-head {
    border-bottom: none;
    .ant-card-extra {
      padding: 0;
    }
  }
`;


// 2. 标题和操作区域

export const CardTitleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
`;

export const CardActions = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
`;

// 3. 公共按钮样式 (StyledButton)

export const StyledButton = styled(Button)`
  &.ant-btn {
    background-color: transparent !important;
    color: ${(props) => props.theme.token.colorPrimary} !important;
    border-color: ${(props) => props.theme.token.colorPrimary} !important;
    font-weight: 330;
    }
`;

// 4. 信息区域的基础样式

export const BaseCardInfoItem = styled.p`
  margin: 0 0 8px;
  color: rgba(136, 143, 163, 1);
  font-weight: 330;
  line-height: 22px;
  font-size: 14px;
  span {
    color: rgba(67, 67, 67, 1);
    font-weight: 330;
    line-height: 22px;
    font-size: 14px;
  }
`;
