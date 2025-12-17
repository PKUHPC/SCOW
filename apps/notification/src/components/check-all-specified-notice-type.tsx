import { Checkbox } from "antd";
import { CheckboxChangeEvent } from "antd/es/checkbox";
import React from "react";
import { NoticeType } from "src/models/notice-type";
import { getNoticeTypeName } from "src/models/notice-type";

export interface SelectAllProps {
  e: CheckboxChangeEvent;
  checkedNoticeType: NoticeType
}

interface Props {
  type: NoticeType;
  handleCheckAll: (props: SelectAllProps) => void;
  disabled?: boolean;
  checked: boolean;
}

export const CheckAllSpecifiedNoticeType: React.FC<Props> = ({ type, disabled, checked, handleCheckAll }) => {

  return (
    <>
      <Checkbox
        disabled={disabled}
        checked={checked}
        onChange={(e) => handleCheckAll({ e, checkedNoticeType: type })}
      >
        {getNoticeTypeName(type)}
      </Checkbox>
    </>
  );
};
