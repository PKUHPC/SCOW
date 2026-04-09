"use client";

import { Button, Form } from "antd";
import { styled } from "styled-components";

import { CodeEditor } from "./CodeEditor";

interface Props {
  defaultCommand?: string;
  placeholder?: string;
  needResetButton?: boolean;
  resetButtonText?: string;
  defaultRows?: number;
}

const defaultPlaceholder = "Please enter command";
const defaultResetButtonText = "Reset";
const defaultRowsCount = 3;

export const CommandInputField = ({
  defaultCommand,
  placeholder = defaultPlaceholder,
  needResetButton = false,
  resetButtonText = defaultResetButtonText,
  defaultRows = defaultRowsCount,
}: Props) => {
  const formInstance = Form.useFormInstance();
  const commandValue = Form.useWatch("command", formInstance) ?? "";
  const isAtDefault = commandValue === (defaultCommand ?? "");
  const normalizedDefaultRows = Math.max(1, defaultRows);

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
          $defaultRows={normalizedDefaultRows}
          value={commandValue}
          onChange={handleChange}
          placeholder={placeholder}
        />
      </CommandEditorShell>

      {needResetButton && (
        <CommandResetButton size="small" onClick={handleReset} disabled={isAtDefault}>
          {resetButtonText}
        </CommandResetButton>
      )}
    </CommandContainer>
  );
};

const CommandContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.palette.gray[4]};
  border-radius: 8px;
  background: ${({ theme }) => theme.token.colorBgContainer};
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const StyledCodeEditor = styled(CodeEditor)<{ $defaultRows: number }>`
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
    min-height: ${({ $defaultRows }) => `${$defaultRows * 24}px`};
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
