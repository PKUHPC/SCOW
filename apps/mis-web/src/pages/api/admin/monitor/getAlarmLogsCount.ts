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

import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { Type } from "@sinclair/typebox";
import dayjs from "dayjs";
import { join } from "path";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { publicConfig } from "src/utils/config";
import { route } from "src/utils/route";

interface GrafanaApiResponse {
  results: {
    [key: string]: {
      status: number;
      frames: GrafanaFrame[];
    };
  };
}

interface GrafanaFrame {
  schema: {
    refId: string;
    meta: {
      typeVersion: [number, number];
      executedQueryString: string;
    };
    fields: {
      name: string;
      type: string;
      typeInfo: {
        frame: string;
        nullable: boolean;
      };
    }[];
  };
  data: {
    values: any[][];
  };
}

interface TransformedRow {
  totalCount: number;
}


const transformGrafanaData = (grafanaData: GrafanaApiResponse): TransformedRow[] => {
  const frames = grafanaData.results.A.frames;
  if (frames.length === 0) return [];

  const schema = frames[0].schema.fields;
  const dataValues = frames[0].data.values;

  if (dataValues.length === 0 || dataValues[0][0] === null) return [];

  const result: TransformedRow[] = [];

  for (let i = 0; i < dataValues[0].length; i++) {
    const row: Partial<TransformedRow> = {};
    for (let j = 0; j < schema.length; j++) {
      const fieldName = schema[j].name;
      row[fieldName as keyof TransformedRow] = dataValues[j][i];
    }
    result.push(row as TransformedRow);
  }

  return result;
};

export const GetAlarmLogsCountSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    from: Type.Number(),
    to: Type.Number(),
    status: Type.String(),
    id: Type.Number(),
    uid: Type.String(),
    type: Type.String(),
  }),

  responses: {
    200: Type.Object({ totalCount: Type.Number() }),
    /** 请求出错 */
    400: Type.Null(),
    /** 调用 grafana 出错 */
    500: Type.Null(),
  },
});

const auth = authenticate((info) =>
  info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default /* #__PURE__*/route(GetAlarmLogsCountSchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const countSql = "SELECT COUNT(DISTINCT a.fingerprint) AS totalCount"
    + " FROM Alert AS a"
    + " LEFT JOIN AlertAnnotation AS aa ON a.ID = aa.AlertID AND aa.Annotation = 'description'"
    + " LEFT JOIN AlertLabel al ON a.ID = al.AlertID AND al.Label = 'severity'"
    + ` WHERE a.startsAt BETWEEN '${dayjs(req.query.from).format("YYYY-MM-DD HH:mm:ss")}'`
        + ` AND '${dayjs(req.query.to).format("YYYY-MM-DD HH:mm:ss")}'`
        + (req.query.status !== "" ? ` AND a.status = '${req.query.status}'` : "");

  const queryData = {
    from: req.query.from.toString(),
    to: req.query.to.toString(),
    queries: [{
      datasource: {
        "type": req.query.type,
        "uid": req.query.uid,
      },
      datasourceId: req.query.id,
      refId: "A",
      intervalMs: 60000,
      maxDataPoints: 681,
      rawSql: countSql,
      format: "table",
    }],
  };

  return await fetch(join(publicConfig.CLUSTER_MONITOR_GRAFANA_URL, "/api/ds/query"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(queryData),
  })
    .then((response) => response.json())
    .then((data: GrafanaApiResponse) => {
      if (!data || !data.results || !data.results.A || data.results.A.status !== 200) {
        return { 400: null };
      }
      return { 200: { totalCount: transformGrafanaData(data)[0].totalCount } };
    })
    .catch(() => ({ 500: null }));
});
