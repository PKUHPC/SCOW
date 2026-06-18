"use client";

import { AppRouterStyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { TableWithSplitLines } from "@scow/lib-web/build/components/styledAntdCom/Table";
import { Typography } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";

export interface UnavailableParam {
  key: string;
  label: string;
  templateValue: string;
  recommendedValue: string;
}

interface Props {
  open: boolean;
  params: UnavailableParam[];
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const p = prefix("app.jobs.launchAppForm.");

export const UnavailableParamsModal = ({ open, params, onConfirm, onCancel }: Props) => {
  const t = useI18nTranslateToString();

  return (
    <AppRouterStyledModal
      open={open}
      title={t(p("unavailableParamsTitle"))}
      onOk={onConfirm}
      onCancel={onCancel}
      okText={t(p("unavailableParamsConfirm"))}
      cancelText={t(p("unavailableParamsCancel"))}
      centered
      width={448}
    >
      <Typography.Paragraph style={{ marginBottom: 16 }}>{t(p("unavailableParamsDesc"))}</Typography.Paragraph>
      <TableWithSplitLines
        dataSource={params}
        pagination={false}
        size="small"
        rowKey="key"
        columns={[
          { title: "", dataIndex: "label", key: "label" },
          {
            title: t(p("unavailableParamColumn")),
            dataIndex: "templateValue",
            key: "templateValue",
            render: (val: string) => <Typography.Text type="danger">{val}</Typography.Text>,
          },
          { title: t(p("recommendedParamColumn")), dataIndex: "recommendedValue", key: "recommendedValue" },
        ]}
      />
    </AppRouterStyledModal>
  );
};
