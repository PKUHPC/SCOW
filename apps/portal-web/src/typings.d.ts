declare module "*.less" {
  const module: any;
  export = module;
}

declare module "*.svg" {
  import { FC, SVGProps } from "react";
  export const ReactComponent: FC<SVGProps<SVGSVGElement>>;

  const src: string;
  export default src;
}

declare namespace NodeJS {
  export interface ProcessEnv {
    BASE_PATH: string | undefined;
    NEXT_PUBLIC_USE_MOCK: string | undefined;
  }
}

declare namespace React {
  interface FC<P = {}> {
    (props: P, context?: any): ReactElement<any, any> | null;
    children: JSX.Element;
  }
}
