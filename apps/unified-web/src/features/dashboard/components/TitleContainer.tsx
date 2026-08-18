import { styled } from "styled-components";

const Container = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
`;

const Title = styled.div`
  font-size: 1em;
  width: max-content;
`;

const SubContainer = styled.div`
  display: flex;
  font-weight: 400;
  font-size: 1em;
  width: max-content;
`;

interface Props {
  total: number;
  name: string;
  display: boolean;
  subName: string;
}

export function TitleContainer({ total, name, display, subName }: Props) {
  if (!display) return null;

  return (
    <Container>
      <Title>{name}</Title>
      <SubContainer>
        <Title style={{ marginRight: "0.35em" }}>{subName}</Title>
        <Title>{total.toFixed(0)}</Title>
      </SubContainer>
    </Container>
  );
}
