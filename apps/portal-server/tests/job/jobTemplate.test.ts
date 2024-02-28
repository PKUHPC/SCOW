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

import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { credentials, status } from "@grpc/grpc-js";
import { JobServiceClient } from "@scow/protos/build/portal/job";
import { createServer } from "src/app";
import { getClusterOps } from "src/clusterops";
import {
  cluster, connectToTestServer,
  createTestItems, resetTestServer, TestSshServer, userId,
} from "tests/file/utils";

let ssh: TestSshServer;
let server: Server;
let client: JobServiceClient;

const jobId = 1111;
const jobId2 = 2222;
const jobInfo = {
  "jobName": "testJob",
  "coreCount": 1,
  "maxTime": 30,
  "nodeCount": 1,
  "partition": "compute",
  "qos": "normal",
  "account": "a_aaa",
  "command": "sleep 20",
  "workingDirectory": "/data/home/demo_admin/scow/jobs/job-20230725-201431",
  "output": "job.%j.out",
  "errorOutput": "job.%j.err",
  "memory": "750MB",
  "extraOptions": {},
};
const templateId = "testJob-1111";

beforeEach(async () => {
  ssh = await connectToTestServer();
  await createTestItems(ssh);

  server = await createServer();
  await server.start();

  const clusterOps = getClusterOps(cluster);

  await clusterOps.job.saveJobTemplate({
    userId, jobInfo, jobId,
  }, server.logger);

  await clusterOps.job.saveJobTemplate({
    userId, jobInfo, jobId:jobId2,
  }, server.logger);

  client = new JobServiceClient(server.serverAddress, credentials.createInsecure());

});

afterEach(async () => {
  await resetTestServer(ssh);
  await server.close();
});


it("get job templates list", async () => {

  const templateList = await asyncUnaryCall(client, "listJobTemplates", {
    cluster, userId,
  });

  expect(templateList.results.length).toBe(2);

});

it("rename job template", async () => {
  const jobName = "修改后";
  await asyncUnaryCall(client, "renameJobTemplate", {
    cluster, userId, templateId, jobName,
  });

  const templateInfo = await asyncUnaryCall(client, "getJobTemplate", {
    cluster, userId, templateId,
  });

  expect(templateInfo?.template?.jobName).toBe(jobName);

});


it("delete job template", async () => {

  const templateInfo = await asyncUnaryCall(client, "getJobTemplate", {
    cluster, userId, templateId,
  });

  expect(templateInfo?.template?.jobName).toBe("testJob");

  await asyncUnaryCall(client, "deleteJobTemplate", {
    cluster, userId, templateId,
  });

  await asyncUnaryCall(client, "getJobTemplate", {
    cluster, userId, templateId,
  }).catch((e) => {
    expect(e.code).toBe(status.NOT_FOUND);
  });

});

