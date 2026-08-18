import { Card } from "antd";
import { useMemo } from "react";
import { PieChartCom } from "src/features/dashboard/components/PieChartCom";
import { TitleContainer } from "src/features/dashboard/components/TitleContainer";
import { styled } from "styled-components";

export interface PaneData {
  itemName: string;
  num: number;
  color: string;
}

interface Props {
  tag: { itemName: string; subName: string };
  paneData: PaneData[];
  loading: boolean;
  hideWhenEmpty?: boolean;
}

const Container = styled.div`
  margin: 0px 0;
`;

const PieChartContainer = styled.div`
  display: flex;
  justify-content: center;
`;

export function InfoPane({ tag, paneData, loading, hideWhenEmpty = false }: Props) {
  const notEmptyData = useMemo(() => paneData.some((item) => item.num > 0), [paneData]);
  const display = hideWhenEmpty ? notEmptyData : true;

  return (
    <Container>
      <Card
        loading={loading}
        type="inner"
        title={
          <TitleContainer
            name={tag.itemName}
            subName={tag.subName}
            total={paneData.reduce((total, item) => total + item.num, 0)}
            display={display}
          />
        }
        style={{ maxHeight: "310px", boxShadow: "0px 2px 10px 0px #1C01011A" }}
      >
        <PieChartContainer>
          <PieChartCom
            pieData={paneData.map((item) => ({
              value: Number.isNaN(item.num) ? 0 : item.num,
              color: item.color,
              itemName: item.itemName,
            }))}
            display={display}
            total={paneData.reduce((total, item) => total + item.num, 0)}
          />
        </PieChartContainer>
      </Card>
    </Container>
  );
}
