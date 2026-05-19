import { useEffect, useState } from "react";

interface Props {
  seconds: number;
}

export const CountdownText: React.FC<Props> = ({ seconds }) => {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining > 0) {
      const timeoutId = setTimeout(() => {
        setRemaining(remaining - 1);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [remaining]);

  return <>{remaining}</>;
};
