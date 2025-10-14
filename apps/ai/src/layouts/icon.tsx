"use client";
import AntdIcon from "@ant-design/icons";

import { useDarkMode } from "./darkMode";

interface Props {
  src: any;
  alt?: string;
}

export function NavIcon({ src, alt = "" }: Props) {
  const { dark } = useDarkMode();

  const altName = alt ? alt : src.substring(src.lastIndexOf("/") + 1, src.lastIndexOf("."));

  return (
    <AntdIcon
      component={({ style, className }: any) => (
        <img
          src={src}
          alt={altName}
          style={{
            ...style,
            transform: "scale(0.9)",
            filter: dark ? "invert(100%)" : "none",
          }}
          className={className}
        />
      )}
    />
  );
}
