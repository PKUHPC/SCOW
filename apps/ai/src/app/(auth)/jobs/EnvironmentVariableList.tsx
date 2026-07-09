"use client";

import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { Form, Tooltip } from "antd";
import { useEffect } from "react";
import { FileSelectModal } from "src/components/FileSelectModal";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { getDefaultBuiltinEnvs, PREDEFINED_ENV_VAR, RESERVED_ENV_KEYS, RESOURCE_ENV_KEYS } from "src/models/envVars";
import { styled, useTheme } from "styled-components";

import { validateEnvKeyFormat } from "./common";
import { AddButton, RemoveButton } from "./ResourceSelectorList";

const EnvListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EnvRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const EnvInputs = styled.div`
  display: flex;
  flex: 1;
  gap: 12px;
`;

// 占位符，用于对齐没有删除按钮的静态行
const ActionPlaceholder = styled.div`
  width: 24px; // 与 RemoveButton 宽度一致
`;

const EnvRemoveButton = styled(RemoveButton)`
  margin-top: 10px;
`;

const p = prefix("app.jobs.environmentVariableList.");

export const BuiltinTooltipProps = {
  arrow: false as const,
  align: { offset: [0, -12] },
  mouseEnterDelay: 0.4,
};

interface Props {
  clusterId?: string; // 给文件选择器使用的集群ID
  homeDir?: string; // WORK_DIR默认值
}

export const EnvironmentVariableList = ({ clusterId, homeDir }: Props) => {
  const theme = useTheme();
  const t = useI18nTranslateToString();
  const form = Form.useFormInstance();
  const builtinTooltipColor = theme.palette.gray[7];

  const envVariables: { key?: string; value?: string }[] = Form.useWatch("envVariables", form) ?? [];

  useEffect(() => {
    const current = form.getFieldValue("envVariables") ?? [];
    if (current.length === 0) {
      form.setFieldValue("envVariables", getDefaultBuiltinEnvs(homeDir));
    }
  }, [envVariables.length]);

  // 当 homeDir 从父组件异步加载完成后，更新 WORK_DIR 的值（仅当 WORK_DIR 值为空时）
  useEffect(() => {
    if (homeDir) {
      const currentEnvs = form.getFieldValue("envVariables") || [];
      if (currentEnvs[0]?.key === PREDEFINED_ENV_VAR.WORK_DIR && !currentEnvs[0].value) {
        form.setFieldValue(["envVariables", 0, "value"], homeDir);
      }
    }
  }, [homeDir]);

  return (
    <Form.List name="envVariables">
      {(fields, { add, remove }) => (
        <EnvListContainer>
          {fields.map(({ key, name, ...restField }) => {
            // 获取当前行的 key 值来决定渲染行为
            const currentKey = form.getFieldValue(["envVariables", name, "key"]);

            // 内置行仅限于固定的前 RESERVED_ENV_KEYS.length 个位置，避免用户手动输入同名 key 时
            // 误触发内置渲染逻辑（如变成不可删除的行或直接隐藏）
            const isAtBuiltinPosition = name < RESERVED_ENV_KEYS.length;

            // 仅当处于内置位置且 key 确实是 VC_GPU_NUM 时才隐藏该行
            if (isAtBuiltinPosition && currentKey === PREDEFINED_ENV_VAR.VC_GPU_NUM) {
              return null;
            }

            const isWorkDir = isAtBuiltinPosition && currentKey === PREDEFINED_ENV_VAR.WORK_DIR;
            const isXdlIp = isAtBuiltinPosition && currentKey === PREDEFINED_ENV_VAR.XDL_IP;
            const isBuiltIn = isWorkDir || isXdlIp;

            return (
              <EnvRow key={key}>
                <EnvInputs>
                  <Form.Item
                    {...restField}
                    name={[name, "key"]}
                    style={{ flex: 1, marginBottom: 0 }}
                    rules={
                      isBuiltIn
                        ? []
                        : [
                            { required: true, message: t(p("keyRequired")) },
                            // 内置环境变量校验
                            () => ({
                              validator(_, value) {
                                // 对六个内置环境变量统一进行重名校验
                                if (value && (RESERVED_ENV_KEYS.includes(value) || RESOURCE_ENV_KEYS.includes(value))) {
                                  return Promise.reject(new Error(t(p("predefinedValidator"))));
                                }
                                return Promise.resolve();
                              },
                            }),
                            validateEnvKeyFormat(t(p("invalidFormat")), t(p("duplicateKey"))),
                          ]
                    }
                  >
                    {isWorkDir ? (
                      <Tooltip
                        title={t("app.jobs.appConfigSection.environmentVariables.workdirHelpTip")}
                        {...BuiltinTooltipProps}
                        color={builtinTooltipColor}
                      >
                        <RoundedInput size="large" disabled value={PREDEFINED_ENV_VAR.WORK_DIR} />
                      </Tooltip>
                    ) : isXdlIp ? (
                      <Tooltip
                        title={t("app.jobs.appConfigSection.environmentVariables.xdlIpHelpTip")}
                        {...BuiltinTooltipProps}
                        color={builtinTooltipColor}
                      >
                        <RoundedInput size="large" disabled value={PREDEFINED_ENV_VAR.XDL_IP} />
                      </Tooltip>
                    ) : (
                      <RoundedInput size="large" placeholder={t(p("keyPlaceholder"))} />
                    )}
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, "value"]}
                    style={{ flex: 1, marginBottom: 0 }}
                    rules={isXdlIp ? [] : [{ required: true, message: t(p("valueRequired")) }]}
                    getValueProps={isXdlIp ? () => ({ value: t(p("xdlIpPlaceholder")) }) : undefined}
                  >
                    {isWorkDir ? (
                      <RoundedInput
                        size="large"
                        placeholder={!clusterId ? t(p("clusterRequired")) : t(p("workDirPlaceholder"))}
                        prefix={
                          <FileSelectModal
                            allowedFileType={["DIR"]}
                            clusterId={clusterId || ""}
                            onSubmit={(path: string) => {
                              form.setFields([{ name: ["envVariables", name, "value"], value: path, touched: true }]);
                              form.validateFields([["envVariables", name, "value"]]);
                            }}
                          />
                        }
                      />
                    ) : isXdlIp ? (
                      <RoundedInput size="large" disabled />
                    ) : (
                      <RoundedInput size="large" placeholder={t(p("valuePlaceholder"))} />
                    )}
                  </Form.Item>
                </EnvInputs>

                {isBuiltIn ? (
                  <ActionPlaceholder />
                ) : (
                  <EnvRemoveButton
                    icon={<MinusOutlined />}
                    onClick={() => remove(name)}
                    aria-label={t(p("removeAriaLabel"))}
                  />
                )}
              </EnvRow>
            );
          })}

          <AddButton icon={<PlusOutlined style={{ color: theme.token.colorPrimary }} />} onClick={() => add({})}>
            {t(p("addButton"))}
          </AddButton>
        </EnvListContainer>
      )}
    </Form.List>
  );
};
