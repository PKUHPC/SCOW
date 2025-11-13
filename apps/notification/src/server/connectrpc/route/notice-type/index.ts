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

import { type ConnectRouter } from "@connectrpc/connect";
import { NoticeTypeService } from "@scow/notification-protos/build/notice_type_pb";
import { checkAuth } from "src/utils/auth/check-auth";
import { enabledNoticeTypes } from "src/utils/message/check-message";

export default (router: ConnectRouter) => {
  router.service(NoticeTypeService, {
    async listNoticeTypes(_, context) {

      await checkAuth(context);

      return {
        noticeTypes: enabledNoticeTypes,
      };
    },
  });
};
