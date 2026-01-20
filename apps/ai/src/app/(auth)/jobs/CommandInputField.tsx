"use client";

import { Button, Form } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { styled } from "styled-components";

import { CodeEditor } from "./CodeEditor";

interface Props {
  defaultCommand?: string;
}

const p = prefix("app.jobs.commandInputField.");

export const CommandInputField = ({ defaultCommand }: Props) => {
  const formInstance = Form.useFormInstance();
  const commandValue = Form.useWatch("command", formInstance) ?? "";
  const isAtDefault = commandValue === (defaultCommand ?? "");
  const t = useI18nTranslateToString();

  const handleChange = (value: string) => {
    formInstance.setFieldsValue({ command: value });
  };

  const handleReset = () => {
    formInstance.setFieldsValue({ command: defaultCommand ?? "" });
  };

  return (
    <CommandContainer>
      <CommandEditorShell>
        <StyledCodeEditor
          value={commandValue}
          onChange={handleChange}
          placeholder={t(p("placeholder"))}
        />
      </CommandEditorShell>

      <CommandResetButton
        size="small"
        onClick={handleReset}
        disabled={isAtDefault}
      >
        {t(p("resetButton"))}
      </CommandResetButton>
    </CommandContainer>
  );
};

const CommandContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.token.colorBorder};
  border-radius: 8px;
  background: ${({ theme }) => theme.token.colorBgContainer};
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);
  padding: 16px 0 5px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const StyledCodeEditor = styled(CodeEditor)`
  width: 100%;
  display: block;
  border: none !important;
  background: transparent !important;

  .cm-editor {
    border: none;
    background: transparent !important;
    box-shadow: none !important;
  }

  .cm-editor.cm-focused {
    outline: none;
  }

  .cm-scroller {
    border: none;
    min-height: calc(3 * 24px);
  }

  .cm-placeholder,
  .cm-gutterElement {
    color:rgba(136, 143, 163, 1)
  }

  .cm-gutters {
    background: transparent !important;
    border: none !important;
    color: ${({ theme }) => theme.token.colorTextDescription};
  }

  .cm-editor .cm-content ::selection,
  .cm-selectionBackground,
  .cm-editor.cm-focused .cm-selectionBackground {
    background: #d6e8ff !important;
    color: ${({ theme }) => theme.token.colorText} !important;
  }

  .cm-activeLine {
    background: #f0f7ff !important;
  }

  .cm-activeLineGutter {
    background: #f0f7ff !important;
  }
`;

const CommandEditorShell = styled.div`
  position: relative;
`;

const CommandResetButton = styled(Button)`
  align-self: flex-end;
  border-radius: 8px !important;
  border-color: ${({ theme }) => theme.token.colorBorderSecondary} !important;
  color: ${({ theme }) => theme.token.colorTextDescription} !important;
  background: ${({ theme }) => theme.token.colorFillQuaternary} !important;
  box-shadow: none !important;
  padding: 0 14px !important;
  margin-right: 5px !important;
  height: 30px !important;

  &:hover {
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
  }

  &:disabled {
    color: ${({ theme }) => theme.token.colorTextDisabled} !important;
    border-color: ${({ theme }) => theme.token.colorBorder} !important;
    background: ${({ theme }) => theme.token.colorFillQuaternary} !important;
  }
`;
