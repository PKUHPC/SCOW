/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import AntdIcon from "@ant-design/icons";
import { theme } from "antd";
import Image from "next/image";

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
      component={({ style, className, fill }: any) => (
        <Image
          src={src}
          alt={altName}
          style={{
            ...style,
            fill,
            // fill: dark ? "#fff" : "#000",
          }}
          width={14}
          height={14}
          className={className}
        />
      )}
    />

  );
}
