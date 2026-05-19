import { Knex } from "@mikro-orm/mysql";
import { NoticeType } from "src/models/notice-type";
import { validateToken } from "src/server/auth/token";
import { ReadStatus, TargetType } from "src/server/entities/UserMessageRead";

import { forkEntityManager } from "../get-orm";

export const hasUnreadMessage = async (token: string) => {
  const info = await validateToken(token);

  if (!info) {
    throw new Error("UNAUTHORIZED");
  }

  const em = await forkEntityManager();
  const knex = em.getConnection().getKnex();

  // 构建子查询：从 message_targets 表获取符合条件的 message_id
  const mtSubquery = knex("message_targets as mt")
    .select("mt.message_id")
    .where(function () {
      this.where("mt.notice_types", "like", `%${NoticeType.SITE_MESSAGE}%`).andWhere(function () {
        this.where("mt.target_type", TargetType.FULL_SITE)
          // 暂时没有通过租户和账户查询的需求
          // .orWhere(function() {
          //   this.where('mt.target_type', TargetType.TENANT)
          //     .andWhere('mt.target_id', info.tenant);
          // })
          // .orWhere(function() {
          //   this.where('mt.target_type', TargetType.ACCOUNT)
          //     .andWhere('mt.target_id', 'in', info.accountAffiliations.map(a => a.accountName));
          // })
          .orWhere(function () {
            this.where("mt.target_type", TargetType.USER).andWhere("mt.target_id", info.identityId);
          });
      });
    });

  const unionSubquery = mtSubquery.as("message_ids");

  // 未读消息的查询：umr 为 NULL（无记录）或明确标记为未读且未删除
  const readConditions = function (this: Knex.QueryBuilder) {
    this.where(function (this: Knex.QueryBuilder) {
      this.whereNull("umr.status").orWhere(function (this: Knex.QueryBuilder) {
        this.where("umr.status", ReadStatus.UNREAD).andWhere("umr.is_deleted", false);
      });
    });
  };
  // 构建最终查询
  const result = await knex("messages as m")
    // 左连接 user_message_read 表，仅限于当前用户的记录
    .leftJoin("user_message_read as umr", function () {
      this.on("m.id", "=", "umr.message_id").andOn("umr.user_id", "=", knex.raw("?", [info.identityId]));
    })
    // 筛选符合条件的 message_id
    .whereIn("m.id", knex.select("message_id").from(unionSubquery))
    .andWhere(readConditions)
    .andWhere(function () {
      this.where("m.expired_at", ">", new Date()).orWhereNull("m.expired_at");
    })
    .limit(1)
    .select("m.*");

  return result.length > 0;
};
