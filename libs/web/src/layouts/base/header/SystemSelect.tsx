import { DownOutlined } from "@ant-design/icons";
import { Dropdown } from "antd";
import React from "react";
import { styled } from "styled-components";

import { JumpToAnotherLink } from "./components";
import { HeaderNavbarLink } from "./index";

interface Props {
  links: HeaderNavbarLink[];
}

const Container = styled.div`
  white-space: nowrap;
  .ant-dropdown-open span{
    color: ${({ theme }) => theme.token.colorPrimary}!important;
  }
`;

const InlineBlockSpan = styled.span`
  cursor: pointer;
  line-height: 36px;
  display: inline-flex;
  margin-right: 4px;
  gap: 8px;
  font-size: 14px;
  padding: 0 12px;
  &:hover {
    background-color: #59595914;
    border-radius: 8px;
  }
  &:active{
    background-color: #59595914;
    border-radius: 8px;
  }
`;

const InlineTextSpan = styled.span<{ $active?: boolean }>`
  span {
    color: ${({ $active, theme }) => ($active ? theme.token.colorPrimary : "#434343")};
  }
`;

export const SystemSelect: React.FC<Props> = ({
  links,
}) => {
  const menuItem = links?.map((item) => {
    return {
      key: `${item?.href}`, label: (
        <JumpToAnotherLink
          icon={item?.icon}
          href={item?.href}
          text={item?.text}
          crossSystem={ item?.crossSystem }
        />
      ),
    };
  });

  const activeItem = links.find((item) => item?.isActive === true);

  return (
    <Container>
      <Dropdown
        trigger={["click"]}
        overlayClassName="head-system-select"
        menu={{
          items: menuItem,
        }}
      >
        <InlineBlockSpan>
          {activeItem?.icon}
          <InlineTextSpan $active={activeItem?.isActive}>{activeItem?.text}</InlineTextSpan>
          <DownOutlined style={{ marginLeft: "4px" }} />
        </InlineBlockSpan>
      </Dropdown>
    </Container>
  );
};
