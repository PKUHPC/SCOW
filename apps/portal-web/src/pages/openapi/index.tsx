import { localSpecResolverPlugin } from "@scow/lib-web/build/utils/openapi";
import { NextPage } from "next";
import dynamic from "next/dynamic";
import { join } from "path";
import { useEffect, useState } from "react";
import { publicConfig } from "src/utils/config";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

const OpenApiPage: NextPage = () => {
  const [spec, setSpec] = useState<object>();

  useEffect(() => {
    void fetch(join(publicConfig.BASE_PATH, "/api/openapi.json"))
      .then((res) => res.json())
      .then(setSpec);
  }, []);

  return spec ? <SwaggerUI spec={spec} plugins={[localSpecResolverPlugin]} /> : null;
};

export default OpenApiPage;
