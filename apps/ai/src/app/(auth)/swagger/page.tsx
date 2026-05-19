"use client";

import "swagger-ui-react/swagger-ui.css";
import dynamic from "next/dynamic";
import { join } from "path";
import { useDocumentTitle } from "src/utils/head";

import { usePublicConfig } from "../context";
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function Page() {
  const {
    publicConfig: { BASE_PATH },
  } = usePublicConfig();

  useDocumentTitle("SCOW AI API");

  return (
    <>
      <SwaggerUI url={join(BASE_PATH, "/api/openapi.json")} />
    </>
  );
}
