import { styled } from "styled-components";

export interface ResourceOptionNode {
  label: string;
  value: number;
  description?: string;
  ownerText?: string;
  children: ResourceOptionNode[];
}

export type ResourceCategory = ResourceOptionNode;

export const CATEGORY_VALUE_PRIVATE = 1;
export const CATEGORY_VALUE_PUBLIC = 2;

export const OwnerDisplayText = styled.span`
  color: ${({ theme }) => theme.palette.gray[6]};
  font-size: 13px;
  margin-left: 16px;
`;
