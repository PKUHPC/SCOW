import { useTheme } from "styled-components";
import { styled } from "styled-components";

interface Props {
  percent: number;
  width?: string;
  height?: string;
  bgColor?: string;
  progressColor?: string;
}

const ProgressBarContainer = styled.div<{ width: string; height: string; $bgColor: string }>`
  display: flex;
  align-items: center;
  width: ${(props) => props.width};
  height: ${(props) => props.height};
  background-color: ${(props) => props.$bgColor};
  border-radius: 5px;
`;

const ProgressBar = styled.div<{ $percent: number; $progressColor: string }>`
  height: 100%;
  background-color: ${(props) => props.$progressColor};
  border-radius: 5px;
  transition: width 0.3s ease;
  width: ${(props) => props.$percent}%;
`;

const ProgressLabel = styled.div`
  width: 55px;
  margin-left: 10px;
  text-align: right;
  font-size: 0.9rem;
`;

export function CustomProgress({ percent, width = "100%", height = "20px", bgColor, progressColor }: Props) {
  const normalizedPercent = Math.min(percent, 100).toFixed(2);
  const theme = useTheme();

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <ProgressBarContainer width={width} height={height} $bgColor={bgColor ?? theme.token.colorBorderSecondary}>
        <ProgressBar $percent={percent} $progressColor={progressColor ?? theme.token.colorPrimary} />
      </ProgressBarContainer>
      <ProgressLabel>{percent === 100 ? "100%" : `${normalizedPercent}%`}</ProgressLabel>
    </div>
  );
}
