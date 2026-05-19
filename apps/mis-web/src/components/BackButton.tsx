import { StepBackwardOutlined } from "@ant-design/icons";
import { Button } from "antd";
import Link from "next/link";

interface Props {
  href: string;
}

export const BackButton: React.FC<Props> = ({ href }) => {
  return (
    <Link href={href} legacyBehavior>
      <Button>
        <StepBackwardOutlined />
      </Button>
    </Link>
  );
};
