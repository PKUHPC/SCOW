"use client";

import { Divider } from "antd";
import React, { useContext, useState } from "react";
import { PageTitle } from "src/components/page-title";
import { ScowParamsContext } from "src/components/scow-params-provider";
import { AdminMessagesTable } from "src/page-components/admin-send-message/admin-messages-table";
import { MessageForm } from "src/page-components/admin-send-message/message-form";
import { getLanguage } from "src/utils/i18n";

const SendMessagePage = () => {
  const { scowLangId } = useContext(ScowParamsContext);
  const language = getLanguage(scowLangId);
  const [refreshFlag, setRefreshFlag] = useState(0);

  return (
    <>
      <PageTitle titleText={language.sendMessage.pageTitle}></PageTitle>
      <Divider />
      <div style={{ marginTop: "40px" }}>
        <MessageForm lang={language} onSendSuccess={() => setRefreshFlag((v) => v + 1)} />
      </div>
      <AdminMessagesTable lang={language} refreshFlag={refreshFlag} />
    </>
  );
};

export default SendMessagePage;
