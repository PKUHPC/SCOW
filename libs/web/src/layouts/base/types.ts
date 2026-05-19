export interface UserInfo {
  identityId: string;
  name?: string;
  token: string;
}

export interface NavItemProps {
  path: string;
  clickToPath?: string;
  text: string;
  Icon: React.ReactNode | React.ForwardRefExoticComponent<{}>;
  match?: (spec: string, pathname: string) => boolean;
  children?: NavItemProps[];
  clickable?: boolean;
  openInNewPage?: boolean;
  handleClick?: () => void;
  hideIfNotActive?: boolean;
}

export interface UserLink {
  text: string;
  url: string;
  openInNewPage?: boolean;
}
