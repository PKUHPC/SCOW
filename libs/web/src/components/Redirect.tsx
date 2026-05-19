import { useRouter } from "next/router";
import { useEffect } from "react";
import { UrlObject } from "url";

declare type Url = UrlObject | string;

interface Props {
  url: Url;
  as?: Url;
}

export const Redirect: React.FC<Props> = ({ url, as }) => {
  const router = useRouter();

  useEffect(() => {
    router.push(url, as);
  }, [router]);

  return null;
};
