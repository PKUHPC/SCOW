"use client";

import { Button, Form } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { styled } from "styled-components";

import { CodeEditor } from "./CodeEditor";

interface Props {
  defaultCommand?: string;
  name?: string;
}

const p = prefix("app.jobs.commandInputField.");

export const CommandInputField = ({ defaultCommand, name = "command" }: Props) => {
  const formInstance = Form.useFormInstance();
  const commandValue = Form.useWatch(name, formInstance) ?? "";
  const isAtDefault = commandValue === (defaultCommand ?? "");
  const t = useI18nTranslateToString();

  const handleChange = (value: string) => {
    formInstance.setFieldValue(name, value);
  };

  const handleReset = () => {
    formInstance.setFieldValue(name, defaultCommand ?? "");
  };

  return (
    <CommandContainer>
      <CommandEditorShell>
        <StyledCodeEditor value={commandValue} onChange={handleChange} placeholder={t(p("placeholder"))} />
      </CommandEditorShell>

      <CommandResetButton size="small" onClick={handleReset} disabled={isAtDefault}>
        {t(p("resetButton"))}
      </CommandResetButton>
    </CommandContainer>
  );
};

const CommandContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.palette.gray[4]};
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

  .cm-content,
  .cm-line {
    font-family: inherit !important;
    font-size: 12px !important;
    font-weight: 300 !important;
    line-height: 20px;
    padding-top: 2px;
    padding-bottom: 2px;
  }

  .cm-editor.cm-focused {
    outline: none;
  }

  .cm-scroller {
    border: none;
    min-height: calc(3 * 24px);
    max-height: calc(20 * 24px);
    overflow-y: auto;
  }

  .cm-placeholder {
    color: ${({ theme }) => theme.palette.gray[6]};
    font-weight: 300 !important;
  }

  .cm-gutterElement {
    color: ${({ theme }) => theme.palette.gray[6]};
    font-weight: 300 !important;
    display: flex !important;
    align-items: center !important;
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
  border-color: ${({ theme }) => theme.palette.gray[3]} !important;
  color: ${({ theme }) => theme.palette.gray[6]} !important;
  background: ${({ theme }) => theme.palette.gray[0]} !important;
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);
  padding: 0 14px !important;
  margin-right: 5px !important;
  height: 30px !important;

  &:hover,
  &:active {
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
  }

  &:disabled {
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    border-color: ${({ theme }) => theme.palette.gray[4]} !important;
    box-shadow: none !important;
  }
`;
