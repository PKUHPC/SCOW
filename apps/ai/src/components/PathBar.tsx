import { ReloadOutlined, RightOutlined } from "@ant-design/icons";
import { Breadcrumb, Button, Input } from "antd";
import { useEffect, useState } from "react";
import { styled } from "styled-components";

interface Props {
  path: string;
  loading: boolean;
  onPathChange: (path: string) => void;
  breadcrumbItemRender: (pathSegment: string, index: number, path: string) => React.ReactNode;
  prefix?: React.ReactNode;
}

const Bar = styled.div`
  display: flex;
  width: 100%;
`;

const BarStateBar = styled(Bar)`
  border: 1px solid ${({ theme }) => theme.token.colorBorder};
  border-radius: ${({ theme }) => theme.token.borderRadius}px;
  padding: 0 8px;
  margin: 0 4px;

  .ant-breadcrumb {
    align-self: center;
  }
`;

export const PathBar: React.FC<Props> = ({ path, loading, onPathChange, breadcrumbItemRender, prefix }) => {
  const [state, setState] = useState<"bar" | "input">("bar");

  const [input, setInput] = useState(path);

  useEffect(() => {
    setInput(path);
  }, [path]);

  const pathSegments = path === "/" ? [""] : path.split("/");

  const icon = path === input ? <ReloadOutlined spin={loading} /> : <RightOutlined />;

  return (
    <Bar
      onBlur={() => {
        setInput(path);
        setState("bar");
      }}
    >
      {state === "input" ? (
        <Input.Search
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          onSearch={(value) => {
            const trimmed = value.trim();
            setInput(trimmed);
            onPathChange(trimmed);
          }}
          enterButton={icon}
          autoFocus
          prefix={prefix}
        />
      ) : (
        <>
          <BarStateBar onClick={() => setState("input")}>
            <Breadcrumb style={{ alignSelf: "center" }}>
              {pathSegments.map((segment, index) => (
                <Breadcrumb.Item key={index}>
                  {breadcrumbItemRender(segment, index, pathSegments.slice(1, index + 1).join("/"))}
                </Breadcrumb.Item>
              ))}
            </Breadcrumb>
          </BarStateBar>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onPathChange(input);
            }}
            icon={icon}
          />
        </>
      )}
    </Bar>
  );
};
