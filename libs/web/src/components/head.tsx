import NextHead from "next/head";

type Props = React.PropsWithChildren<{
  title: string;
  titleTag?: string;
}>;

export const Head: React.FC<Props> = ({ title, titleTag, children }) => {
  return (
    <NextHead>
      <title>{`${title} ${titleTag || "- SCOW"}`}</title>
      {children}
    </NextHead>
  );
};
