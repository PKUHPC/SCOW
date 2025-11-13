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

import { FloatButton } from "antd";
import { IncomingMessage } from "http";
import dynamic from "next/dynamic";
import Image from "next/image";
import { parseCookies, setCookie } from "nookies";
import React, { PropsWithChildren, useEffect, useState } from "react";
import { getCurrentLangLibWebText } from "src/utils/libWebI18n/libI18n";

const _modes = ["system", "dark", "light"] as const;


export type DarkMode = typeof _modes[number];

const DarkModeContext = React.createContext<{
  mode: DarkMode;
  dark: boolean;
  setMode: (mode: DarkMode) => void;
}>(undefined!);

export const useDarkMode = () => React.useContext(DarkModeContext);

// all are icons imported from svg files
export interface DarkModeButtonProps {
  light: any;
  system: any;
  dark: any;
  languageId: string;
  basePath?: string;
}

const DarkModeButtonInternal = ({ dark, light, system, languageId }: DarkModeButtonProps) => {
  const { mode, setMode } = useDarkMode();

  const systemColor = languageId ? getCurrentLangLibWebText(languageId, "darkModeSystem") : "跟随系统";
  const lightColor = languageId ? getCurrentLangLibWebText(languageId, "darkModeLight") : "亮色";
  const darkColor = languageId ? getCurrentLangLibWebText(languageId, "darkModeDark") : "暗色";

  const icons = {
    system: [system, "system", systemColor],
    light: [light, "light", lightColor],
    dark: [dark, "dark", darkColor],
  };

  const [icon, alt, label] = icons[mode];

  return (
    <FloatButton
      onClick={() => setMode(mode === "system" ? "dark" : mode === "dark" ? "light" : "system")}
      icon={<Image src={icon} alt={alt} width={20} height={20} />}
      tooltip={label}
      // icon={icon}
    />
  );
};

export interface DarkModeCookie {
  dark: boolean;
  mode: DarkMode;
}


interface Props {
  initial?: DarkModeCookie;
}

const DARK_MODE_COOKIE_NAME = "scow-dark";

export function getDarkModeCookieValue(req?: IncomingMessage): DarkModeCookie | undefined {
  const darkModeCookie = parseCookies({ req })[DARK_MODE_COOKIE_NAME];

  return darkModeCookie ? JSON.parse(darkModeCookie) : undefined;
}

// disable ssr for the button
// for the image rendered in server and client is different
export const DarkModeButton = dynamic(() => Promise.resolve(DarkModeButtonInternal), { ssr: false });

export const DarkModeProvider = ({ initial, children }: PropsWithChildren<Props>) => {

  const [mode, setMode] = useState<DarkMode>(initial?.mode ?? "system");

  const [dark, setDark] = useState(initial?.dark ?? false);

  useEffect(() => {
    setCookie(null, DARK_MODE_COOKIE_NAME, JSON.stringify({ mode, dark } as DarkModeCookie), {
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
  }, [dark, mode]);

  useEffect(() => {
    if (mode === "system") {

      const onChange = function(this: MediaQueryList, ev: MediaQueryListEvent) {
        setDark(ev.matches);
      };

      const media = window.matchMedia("(prefers-color-scheme: dark)");

      setDark(media.matches);

      media.addEventListener("change", onChange);

      return () => media.removeEventListener("change", onChange);
    } else {
      setDark(mode === "dark");
    }
  }, [mode]);

  return (
    <DarkModeContext.Provider value={{ mode, dark, setMode }}>
      {children}
    </DarkModeContext.Provider>

  );
};
