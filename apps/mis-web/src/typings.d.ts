declare module "*.less" {
  const module: any;
  export = module;
}

// declare module "*.svg" {
//   import { FC, SVGProps } from "react";
//   export const ReactComponent: FC<SVGProps<SVGSVGElement>>;

//   const src: string;
//   export default src;
// }

declare namespace NodeJS {
  export interface ProcessEnv {
    NEXT_PUBLIC_BASE_PATH: string;
    NEXT_PUBLIC_USE_MOCK: string;
  }
}
