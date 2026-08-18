import { useContext } from "react";
import { DisplayModeContext } from "src/features/dashboard/DisplayModeContext";
import { styled } from "styled-components";

interface Props {
  percentage: number;
  value: number;
  status: string;
  color: string;
}

const TextContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: ${({ color }) => color};

  .percentage {
    font-size: 2em;
  }

  .value {
    font-size: 1.5em;
  }

  .status {
    font-size: 1em;
  }

  .simplifiedStatus {
    font-size: 1.5em;
    white-space: nowrap;
  }
`;

export function PieInfo({ percentage, value, status, color }: Props) {
  const isFullDisplayMode = useContext(DisplayModeContext);

  return (
    <TextContainer color={color}>
      {isFullDisplayMode ? (
        <>
          <div className="percentage">{percentage}%</div>
          <div style={{ height: "2px", backgroundColor: "#DEDEDE", width: "7.5em" }} />
          <div className="value">{value}</div>
          <div className="status">{status}</div>
        </>
      ) : (
        <div className="simplifiedStatus">
          {value} {status}
        </div>
      )}
    </TextContainer>
  );
}
