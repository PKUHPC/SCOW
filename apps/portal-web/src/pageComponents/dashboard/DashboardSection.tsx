import { Card } from "antd";
import { CSSProperties, PropsWithChildren } from "react";

type Props = PropsWithChildren<{
  title: React.ReactNode;
  extra?: React.ReactNode;
  style?: CSSProperties;
}>;

export const DashboardSection: React.FC<Props> = ({ title, extra, style, children }) => {
  return (
    <Card style={style} title={title} extra={extra}>
      {children}
    </Card>
  );
};
