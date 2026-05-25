"use client";

import { localSpecResolverPlugin } from "@scow/lib-web/build/utils/openapi";
import "swagger-ui-react/swagger-ui.css";
import dynamic from "next/dynamic";
import { join } from "path";
import { useEffect, useState } from "react";
import { useDocumentTitle } from "src/utils/head";

import { usePublicConfig } from "../context";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function Page() {
  const [spec, setSpec] = useState<object>();
  const {
    publicConfig: { BASE_PATH },
  } = usePublicConfig();

  useEffect(() => {
    void fetch(join(BASE_PATH, "/api/openapi.json"))
      .then((res) => res.json())
      .then(setSpec);
  }, [BASE_PATH]);

  useDocumentTitle("SCOW AI API");

  return spec ? <SwaggerUI spec={spec} plugins={[localSpecResolverPlugin]} /> : null;
}
