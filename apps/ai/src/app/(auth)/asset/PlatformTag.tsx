import { hexToRgba } from "src/utils/color";

interface PlatformTagProps {
  children: React.ReactNode;
  color: string;
}

export const PlatformTag = ({ children, color }: PlatformTagProps) => {
  const light1 = hexToRgba(color, 0.08);
  const light2 = hexToRgba(color, 0.08);

  return (
    <div
      style={{
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        height: "20px",
        gap: "4px",
        padding: "0px 8px",
        borderRadius: "6px",
        background: `linear-gradient(90deg, ${light1} 0%, ${light2} 99.37%)`,
        color,
      }}
    >
      {children}
    </div>
  );
};
