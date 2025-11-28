import { Head as OriginalHead } from "@scow/lib-web/build/components/head";
import { publicConfig } from "src/utils/config";

type Props = React.PropsWithChildren<{
  title: string;
}>;

export const Head: React.FC<Props> = ({ title, children }) => {
  return (
    <OriginalHead title={title} titleTag={publicConfig?.UI_CONFIG?.titleTag}>
      {children}
    </OriginalHead>
  );
};
