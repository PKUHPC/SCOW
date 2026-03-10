import { FilterFormContainer } from "@scow/lib-web/build/components/FilterFormContainer";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { Button, Form } from "antd";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";

export interface UserSearchFilters {
  userId?: string;
  name?: string;
}

interface Props {
  onSearch: (filters: UserSearchFilters) => void;
  /** 右侧额外内容（如操作按钮），会与表单同排显示 */
  extra?: React.ReactNode;
  /** 是否渲染默认的白色容器，默认 true */
  container?: boolean;
}

const pCommon = prefix("common.");

export const UserSearchForm: React.FC<Props> = ({ onSearch, extra, container = true }) => {
  const t = useI18nTranslateToString();
  const [form] = Form.useForm<UserSearchFilters>();

  const formNode = (
    <Form
      form={form}
      layout="inline"
      onFinish={(values) => {
        onSearch({
          userId: values.userId?.trim(),
          name: values.name?.trim(),
        });
      }}
      style={{ width: "100%" }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        width: "100%",
      }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", flex: 1, minWidth: 260 }}>
          <Form.Item label={t(pCommon("userId"))} name="userId">
            <Input allowClear />
          </Form.Item>
          <Form.Item label={t(pCommon("name"))} name="name">
            <Input allowClear />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {t(pCommon("search"))}
            </Button>
          </Form.Item>
        </div>
        {extra ? (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
            {extra}
          </div>
        ) : null}
      </div>
    </Form>
  );

  return container ? <FilterFormContainer>{formNode}</FilterFormContainer> : formNode;
};

interface FilterableUser {
  userId?: string;
  name?: string;
}

interface UsersResult<T extends FilterableUser> {
  results: T[];
}

export const filterUsersByIdOrName = <T extends FilterableUser>(
  data: UsersResult<T> | undefined,
  filters: UserSearchFilters,
) => {
  if (!data?.results) {
    return data;
  }

  const userIdFilter = filters.userId?.trim().toLowerCase();
  const nameFilter = filters.name?.trim().toLowerCase();

  if (!userIdFilter && !nameFilter) {
    return data;
  }

  const results = data.results.filter((item) => {
    const userId = item.userId?.toLowerCase() ?? "";
    const name = item.name?.toLowerCase() ?? "";
    const userIdMatch = !userIdFilter || userId.includes(userIdFilter);
    const nameMatch = !nameFilter || name.includes(nameFilter);
    return userIdMatch && nameMatch;
  });

  return {
    ...data,
    results,
  };
};
