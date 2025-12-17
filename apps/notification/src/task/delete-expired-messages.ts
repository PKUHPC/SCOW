import dayjs from "dayjs";
import cron from "node-cron";
import { notificationConfig } from "src/server/config/notification";
import { AdminMessageConfig } from "src/server/entities/AdminMessageConfig";
import { Message } from "src/server/entities/Message";
import { forkEntityManager } from "src/utils/get-orm";
import { logger } from "src/utils/logger";

let deleteIsRunning = false;

export async function deleteExpiredMessages() {
  logger.info("Starting delete expired messages at %s", dayjs().toISOString());

  const em = await forkEntityManager();
  let deletedNum = 0;
  const batchSize = 1000;
  let lastId = BigInt(0);

  // 1. 先处理有 expiredAt 的
  while (true) {
    const messages = await em.find(
      Message,
      { id: { $gt: lastId }, expiredAt: { $lte: new Date() }, category: { $ne: "Admin" } },
      { limit: batchSize, orderBy: { id: "asc" }, fields: ["id"]},
    );

    if (messages.length === 0) {
      break;
    }

    await em.removeAndFlush(messages);
    lastId = messages[messages.length - 1].id;
    deletedNum += messages.length;
  }

  // 2. 再处理消息配置中设置的过期时间
  lastId = BigInt(0);
  const messageConfigs = await em.find(AdminMessageConfig, {}, { limit: 1 });

  if (messageConfigs.length === 0) {
    return;
  }
  // 目前所有消息类型的过期时间均一致
  // 若改为不一致则按消息类型进行删除即可
  while (true) {
    const messages = await em.find(Message,
      {
        id: { $gt: lastId },
        category: { $ne: "Admin" },
        createdAt: {
          $lte: dayjs(new Date()).subtract(Number(messageConfigs[0]?.expiredAfterSeconds), "seconds").toDate(),
        } },
      { limit: batchSize, orderBy: { id: "asc" }, fields: ["id"]},
    );

    if (messages.length === 0) {
      break;
    }

    await em.removeAndFlush(messages);
    lastId = messages[messages.length - 1].id;
    deletedNum += messages.length;
  }

  logger.info(
    "This round of deleting expired messages is completed at %s, deleted %d messages.",
    dayjs().toISOString(),
    deletedNum,
  );
  return;
}

const trigger = async () => {
  if (deleteIsRunning) return;

  deleteIsRunning = true;
  try {
    await deleteExpiredMessages();
  } finally {
    deleteIsRunning = false;
  }
};

const task = cron.schedule(
  notificationConfig.deleteExpiredMessages.cron,
  () => {
    trigger().catch((error) => {
      console.error("Error deleting expired message:", error);
    });
  },
  {
    timezone: "Asia/Shanghai",
    scheduled: true,
  },
);

export const startDeleteExpiredMessages = () => {
  task.start();
  logger.info("The timer for deleting expired messages has started");
};

export const stopDeleteExpiredMessages = () => {
  task.stop();
  logger.info("The timer for deleting expired messages has stopped");
};
