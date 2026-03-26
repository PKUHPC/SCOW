import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback } from "react";
import { useDarkMode } from "src/layouts/darkMode";
import { styled } from "styled-components";

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  height?: string;
  placeholder?: string;
  className?: string;
}

const Container = styled.div`
  border: 1px solid ${({ theme }) => theme.token.colorBorder};
  border-radius: ${({ theme }) => theme.token.borderRadius};
`;


const extensions = [StreamLanguage.define(shell)];

export const CodeEditor: React.FC<Props> = ({ value, onChange, height = "", placeholder = "", className }) => {
  const { dark } = useDarkMode();
  return (
    <Container className={className}>
      <CodeMirror
        value={value}
        height={height}
        placeholder={placeholder}
        theme={dark ? githubDark : githubLight}
        onChange={useCallback((value: string) => {
          onChange?.(value);
        }, [onChange])}
        extensions={extensions}
      />
    </Container>
  );
};
