"use client";

import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { Form } from "antd";
import { FileSelectModal } from "src/components/FileSelectModal";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { styled, useTheme } from "styled-components";

import { createMountTargetRules, validateMountPoints } from "./common";
import { AddButton, RemoveButton } from "./ResourceSelectorList";

const MountListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const MountRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const MountInputs = styled.div`
  display: flex;
  flex: 1;
  gap: 12px;
`;

const MountRemoveButton = styled(RemoveButton)`
  margin-top: 10px;
`;

const p = prefix("app.jobs.mountPointList.");

interface Props {
  clusterId: string;
}

export const MountPointList = ({ clusterId }: Props) => {
  const theme = useTheme();
  const form = Form.useFormInstance();
  const t = useI18nTranslateToString();

  return (
    <Form.List name="mountPoints">
      {(fields, { add, remove }) => (
        <MountListContainer>
          {fields.map(({ key, name, ...restField }) => (
            <MountRow key={key}>
              <MountInputs>
                <Form.Item
                  {...restField}
                  name={[name, "source"]}
                  style={{ flex: 1, marginBottom: 0 }}
                  rules={[
                    { required: true, message: t(p("sourceRequired")) },
                    // 添加的自定义校验器以确保挂载点不重复
                    validateMountPoints(t(p("duplicateSource")), t(p("sourceConflictsWithWorkingDir"))),
                  ]}
                >
                  <RoundedInput
                    size="large"
                    disabled
                    placeholder={!clusterId ? t(p("selectClusterFirst")) : t(p("selectSourcePath"))}
                    prefix={
                      <FileSelectModal
                        allowedFileType={["DIR"]}
                        onSubmit={(path: string) => {
                          form.setFields([{ name: ["mountPoints", name, "source"], value: path, touched: true }]);
                          form.validateFields([["mountPoints", name, "source"]]);
                        }}
                        clusterId={clusterId}
                      />
                    }
                  />
                </Form.Item>

                <Form.Item
                  {...restField}
                  name={[name, "target"]}
                  style={{ flex: 1, marginBottom: 0 }}
                  rules={[
                    { required: true, message: t(p("targetRequired")) },
                    ...createMountTargetRules(
                      ["datasets", "algorithms", "models", "mountPoints"],
                      "mountPoints",
                      name,
                      t(p("targetRootNotAllowed")),
                      t(p("duplicateTarget")),
                    ),
                  ]}
                >
                  <RoundedInput size="large" placeholder={t(p("targetPlaceholder"))} />
                </Form.Item>
              </MountInputs>

              <MountRemoveButton
                icon={<MinusOutlined />}
                onClick={() => remove(name)}
                aria-label={t(p("removeAriaLabel"))}
              />
            </MountRow>
          ))}

          <AddButton icon={<PlusOutlined style={{ color: theme.token.colorPrimary }} />} onClick={() => add({})}>
            {t(p("addButton"))}
          </AddButton>
        </MountListContainer>
      )}
    </Form.List>
  );
};
