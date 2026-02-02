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

"use client";
import { styled } from "styled-components";

interface Props {
  sidebarShown: boolean;
  breakpoint: number;
  onClick: () => void;
}

const Mask = styled.div<{ $sidebarShown: boolean, $breakpoint: number }>`
  position: absolute;
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.35);
  z-index:2;

  display: none;

  @media (max-width: ${(props) => props.$breakpoint}px) {
    display: ${(props) => props.$sidebarShown ? "initial" : "none"};
  }
`;

export default function BodyMask(props: Props) {

  return (
    <Mask
      onClick={props.onClick}
      $breakpoint={props.breakpoint}
      $sidebarShown={props.sidebarShown}
    />
  );
}
