import { SqlEntityManager } from "@mikro-orm/mysql";
import { Seeder } from "@mikro-orm/seeder";
import { internalMessageTypesMap } from "src/models/message-type";
import { NoticeType } from "src/models/notice-type";
import { AdminMessageConfig } from "src/server/entities/AdminMessageConfig";

export const AdminMessageConfigSeeder = () =>
  class AdminMessageConfigSeeder extends Seeder {
    async run(em: SqlEntityManager): Promise<void> {
      // await em.getRepository(AdminMessageConfig).nativeDelete({}); // 清空表数据

      for (const messageType of internalMessageTypesMap.keys()) {
        const existingAdminMessageConfig = await em.findOne(AdminMessageConfig, {
          messageType,
          noticeType: NoticeType.SITE_MESSAGE,
        });

        if (!existingAdminMessageConfig) {
          em.persist(
            new AdminMessageConfig({
              messageType,
              noticeType: NoticeType.SITE_MESSAGE,
              enabled: true,
              canUserModify: false,
            }),
          );
        }
      }

      await em.flush();
    }
  };
