import { LoadingOutlined } from "@ant-design/icons";

export const Loading: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100vh",
        minHeight: "100dvh",
        flex: 1,
      }}
    >
      <LoadingOutlined style={{ fontSize: "24px", color: "black" }} />
    </div>
  );
};
