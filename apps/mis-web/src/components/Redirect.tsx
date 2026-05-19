import Router from "next/router";
import { useEffect } from "react";
import { UrlObject } from "url";

declare type Url = UrlObject | string;

interface Props {
  url: Url;
  as?: Url;
}

export const Redirect: React.FC<Props> = ({ url, as }) => {
  useEffect(() => {
    Router.push(url, as);
  }, []);

  return null;
};
