import { FloatButton } from "antd";
import { DarkModeButton, DarkModeButtonProps } from "src/layouts/darkMode";

export const AppFloatButtons = ({ darkModeButtonProps }: { darkModeButtonProps: DarkModeButtonProps }) => {
  return (
    <FloatButton.Group shape="circle" style={{ right: 24 }}>
      <DarkModeButton {...darkModeButtonProps} />
      <FloatButton.BackTop />
    </FloatButton.Group>
  );
};
