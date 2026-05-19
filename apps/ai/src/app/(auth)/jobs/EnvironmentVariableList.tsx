"use client";

import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { Form } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
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

const EnvRemoveButton = styled(RemoveButton)`
  margin-top: 10px;
`;

const p = prefix("app.jobs.environmentVariableList.");

export const EnvironmentVariableList = () => {
  const theme = useTheme();
  const t = useI18nTranslateToString();

  return (
    <Form.List name="envVariables">
      {(fields, { add, remove }) => (
        <EnvListContainer>
          {fields.map(({ key, name, ...restField }) => (
            <EnvRow key={key}>
              <EnvInputs>
                <Form.Item
                  {...restField}
                  name={[name, "key"]}
                  style={{ flex: 1, marginBottom: 0 }}
                  rules={[
                    { required: true, message: t(p("keyRequired")) },
                    validateEnvKeyFormat(t(p("invalidFormat")), t(p("duplicateKey"))),
                  ]}
                >
                  <RoundedInput size="large" placeholder={t(p("keyPlaceholder"))} />
                </Form.Item>

                <Form.Item
                  {...restField}
                  name={[name, "value"]}
                  style={{ flex: 1, marginBottom: 0 }}
                  rules={[{ required: true, message: t(p("valueRequired")) }]}
                >
                  <RoundedInput size="large" placeholder={t(p("valuePlaceholder"))} />
                </Form.Item>
              </EnvInputs>

              <EnvRemoveButton
                icon={<MinusOutlined />}
                onClick={() => remove(name)}
                aria-label={t(p("removeAriaLabel"))}
              />
            </EnvRow>
          ))}

          <AddButton icon={<PlusOutlined style={{ color: theme.token.colorPrimary }} />} onClick={() => add({})}>
            {t(p("addButton"))}
          </AddButton>
        </EnvListContainer>
      )}
    </Form.List>
  );
};
