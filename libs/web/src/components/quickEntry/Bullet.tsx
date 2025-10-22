// 小圆点组件
import { styled } from "styled-components";

const Dot = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  border-radius: 50%;
  display:inline-block;
`;

interface BulletProps {
  style?: React.CSSProperties;
}


const Bullet: React.FC<BulletProps> = ({ style }) => (
  <Dot style={style}>
  </Dot>
);

export default Bullet;
