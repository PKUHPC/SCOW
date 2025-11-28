import { Head as OriginalHead } from "@scow/lib-web/build/components/head";
import { trpc } from "src/utils/trpc";

type Props = React.PropsWithChildren<{
  title: string;
}>;

export const Head: React.FC<Props> = ({ title, children }) => {
  const { data: publicConfig } = trpc.config.publicConfig.useQuery();
  const titleTag = publicConfig?.uiConfig?.config?.titleTag;

  return (
    <OriginalHead title={title} titleTag={titleTag}>
      {children}
    </OriginalHead>
  );
};
