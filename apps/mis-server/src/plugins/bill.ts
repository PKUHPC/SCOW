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

import { plugin } from "@ddadaal/tsgrpc-server";
import cron from "node-cron";
import { misConfig } from "src/config/mis";
import { BillType } from "src/entities/AccountBill";
import { generateBill, generateCustomTermBills } from "src/tasks/bill";

export interface BillPlugin {
  yearly: {
    start: () => void;
    schedule: string;
    generate: (term?: string) => void;
  };
  monthly: {
    start: () => void;
    schedule: string;
    generate: (term?: string) => void;
  };
}

export const billPlugin = plugin(async (f) => {
  const logger = f.logger.child({ plugin: "bill" });

  if (!misConfig?.bill) {
    return;
  }

  const monthlyBillTask = misConfig.bill.monthlyCron && cron.schedule(
    misConfig.bill.monthlyCron,
    () => { void generateBill(f.ext.orm.em.fork(), BillType.MONTHLY, logger); },
    {
      timezone: "Asia/Shanghai",
      scheduled: true,
    });

  const yearlyBillTask = misConfig.bill.yearlyCron && cron.schedule(
    misConfig.bill.yearlyCron,
    () => { void generateBill(f.ext.orm.em.fork(),BillType.YEARLY, logger); },
    {
      timezone: "Asia/Shanghai",
      scheduled: true,
    });

  logger.info("Accounts bill task started.");

  f.addCloseHook(() => {
    if (monthlyBillTask) monthlyBillTask.stop();
    if (yearlyBillTask) yearlyBillTask.stop();
    logger.info("Generate accounts bill task stopped.");
  });

  f.addExtension("monthly", (({
    start: () => {
      if (monthlyBillTask) monthlyBillTask.start();
      logger.info("Generate accounts monthly bill started");
    },
    schedule: misConfig.bill.monthlyCron,
    generate: (term?: string) => { void generateBill(f.ext.orm.em.fork(), BillType.MONTHLY, logger, term); },
  } as unknown) as BillPlugin["monthly"]));

  f.addExtension("yearly", (({
    start: () => {
      if (yearlyBillTask) yearlyBillTask.start();
      logger.info("Generate accounts yearly bill started");
    },
    schedule: misConfig.bill.monthlyCron,
    generate: (term?: string) => { void generateBill(f.ext.orm.em.fork(), BillType.YEARLY, logger, term); },
  } as unknown) as BillPlugin["monthly"]));

  if (misConfig.bill.customTerms) {
    void generateCustomTermBills(misConfig.bill.customTerms, f.ext.orm.em.fork(), logger);
  }
});
