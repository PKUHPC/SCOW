import { Card } from "antd";
import type { CSSProperties, PropsWithChildren, ReactNode } from "react";

type Props = PropsWithChildren<{
  title: ReactNode;
  extra?: ReactNode;
  style?: CSSProperties;
}>;

export function DashboardSection({ title, extra, style, children }: Props) {
  return (
    <Card style={style} title={title} extra={extra}>
      {children}
    </Card>
  );
}
