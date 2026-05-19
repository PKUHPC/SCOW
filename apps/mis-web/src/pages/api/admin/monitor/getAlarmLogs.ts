import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { Static, Type } from "@sinclair/typebox";
import dayjs from "dayjs";
import { join } from "path";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { publicConfig } from "src/utils/config";
import { DEFAULT_GRAFANA_URL } from "src/utils/constants";
import { route } from "src/utils/route";

interface GrafanaApiResponse {
  results: Record<
    string,
    {
      status: number;
      frames: GrafanaFrame[];
    }
  >;
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
  id: number;
  status: string;
  severity: string;
  fingerprint: string;
  description: string;
  startsAt: number;
  endsAt: number | null;
}

const GetAlarmLogsResponse = Type.Array(
  Type.Object({
    id: Type.Number(),
    status: Type.String(),
    severity: Type.String(),
    fingerprint: Type.String(),
    description: Type.String(),
    startsAt: Type.Number(),
    endsAt: Type.Union([Type.Number(), Type.Null()]),
  }),
);

type GetAlarmLogsResponse = Static<typeof GetAlarmLogsResponse>;

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

export const GetAlarmLogsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    from: Type.Number(),
    to: Type.Number(),
    status: Type.String(),
    id: Type.Number(),
    uid: Type.String(),
    type: Type.String(),
    page: Type.Number(),
    pageSize: Type.Number(),
  }),

  responses: {
    200: Type.Object({
      results: GetAlarmLogsResponse,
    }),
    /** 请求出错 */
    400: Type.Null(),
    /** 调用 grafana 出错 */
    500: Type.Null(),
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default /* #__PURE__*/ route(GetAlarmLogsSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const querySql =
    "SELECT t2.* FROM" +
    " (SELECT fingerprint, MAX(ID) AS tid, startsAt FROM Alert GROUP BY startsAt, fingerprint) AS t1" +
    " INNER JOIN (" +
    " SELECT a.ID AS id, a.fingerprint, a.status," +
    " a.startsAt, a.endsAt, aa.value AS description, al.Value AS severity" +
    " FROM Alert AS a" +
    " LEFT JOIN AlertAnnotation AS aa ON a.ID = aa.AlertID" +
    " LEFT JOIN AlertLabel al ON a.ID = al.AlertID" +
    " WHERE aa.Annotation = 'description' AND al.Label = 'severity'" +
    ` AND a.startsAt BETWEEN '${dayjs(req.query.from).format("YYYY-MM-DD HH:mm:ss")}'` +
    ` AND '${dayjs(req.query.to).format("YYYY-MM-DD HH:mm:ss")}'` +
    (req.query.status !== "" ? ` AND a.status = '${req.query.status}'` : "") +
    " ) AS t2 ON t1.tid = t2.id" +
    ` LIMIT ${req.query.pageSize} OFFSET ${(req.query.page - 1) * req.query.pageSize};`;

  // 发送请求
  const queryData = {
    from: req.query.from.toString(),
    to: req.query.to.toString(),
    queries: [
      {
        datasource: {
          type: req.query.type,
          uid: req.query.uid,
        },
        datasourceId: req.query.id,
        refId: "A",
        intervalMs: 60000,
        maxDataPoints: 681,
        rawSql: querySql,
        format: "table",
      },
    ],
  };

  return await fetch(join(publicConfig.CLUSTER_MONITOR.grafanaUrl ?? DEFAULT_GRAFANA_URL, "/api/ds/query"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(queryData),
  })
    .then((response) => response.json())
    .then((data: GrafanaApiResponse) => {
      // 检查数据是否存在或为空
      if (!data?.results?.A || data.results.A.status !== 200) {
        return { 400: null };
      }
      return {
        200: {
          results: transformGrafanaData(data),
        },
      };
    })
    .catch(() => ({ 500: null }));
});
