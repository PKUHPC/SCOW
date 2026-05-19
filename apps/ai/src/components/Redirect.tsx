"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface Props {
  href: string;
}

export const Redirect: React.FC<Props> = ({ href }) => {
  const router = useRouter();

  useEffect(() => {
    router.push(href);
  }, []);

  return null;
};
