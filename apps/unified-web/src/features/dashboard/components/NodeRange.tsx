import { Card, Statistic, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";

const { Text } = Typography;

interface Props {
  runningJobs: string;
  pendingJobs: string;
  loading: boolean;
  display: boolean;
}

const JobInfoContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-left: 15px;
  padding-right: 15px;
`;

const JobNumber = styled(Statistic)<{ color: string }>`
  margin: 0;
  & .ant-statistic-content-value-int {
    font-size: clamp(24px, 5vw, 64px);
    color: ${(props) => props.color};
    white-space: nowrap;
  }
`;

const JobLabel = styled(Text)`
  margin: 0;
  color: #43434399 !important;
`;

const JobInfoRow = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
  border-bottom: 2px solid #dedede;
  justify-content: space-between;
`;

const Container = styled.div`
  margin: 0px 0;
`;

export function NodeRange({ runningJobs, pendingJobs, loading, display }: Props) {
  const { t } = useTranslation("dashboard");
  if (!display) return null;

  return (
    <Container>
      <Card
        type="inner"
        title={<span style={{ fontSize: "1em" }}>{t("dashboard.nodeRange.jobs", "作业")}</span>}
        style={{ maxHeight: "310px", boxShadow: "0px 2px 10px 0px #1C01011A" }}
        loading={loading}
      >
        <JobInfoContainer>
          <JobInfoRow>
            <JobNumber color="#D1CB5B" value={runningJobs} />
            <JobLabel style={{ fontSize: "18px" }}>{t("dashboard.nodeRange.running", "运行中")}</JobLabel>
          </JobInfoRow>
          <JobInfoRow style={{ marginTop: "5px", marginBottom: "25px" }}>
            <JobNumber color="#A58E74" value={pendingJobs} />
            <JobLabel style={{ fontSize: "18px" }}>{t("dashboard.nodeRange.pending", "排队中")}</JobLabel>
          </JobInfoRow>
        </JobInfoContainer>
      </Card>
    </Container>
  );
}
