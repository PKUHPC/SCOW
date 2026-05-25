"use client";

import { localSpecResolverPlugin } from "@scow/lib-web/build/utils/openapi";
import "swagger-ui-react/swagger-ui.css";
import dynamic from "next/dynamic";
import { join } from "path";
import { useContext, useEffect, useState } from "react";
import { ScowParamsContext } from "src/components/ScowParamsProvider";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function Page() {
  const [spec, setSpec] = useState<object>();
  const { basePath } = useContext(ScowParamsContext);

  useEffect(() => {
    void fetch(join(basePath, "/api/openapi.json"))
      .then((res) => res.json())
      .then(setSpec);
  }, [basePath]);

  return spec ? <SwaggerUI spec={spec} plugins={[localSpecResolverPlugin]} /> : null;
}
