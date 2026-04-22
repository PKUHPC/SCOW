"use client";

import { Divider } from "antd";
import React, { useContext } from "react";
import { PageTitle } from "src/components/page-title";
import { ScowParamsContext } from "src/components/scow-params-provider";
import { CreateMessageTypeForm } from "src/page-components/custom-message-type/create";
import { getLanguage } from "src/utils/i18n";

const SendMessagePage = () => {

  const { scowLangId } = useContext(ScowParamsContext);
  const language = getLanguage(scowLangId);

  return (
    <>
      <PageTitle
        titleText={language.createCustomMessageType.pageTitle}
      />
      <Divider />
      <div style={{ marginTop: "40px" }}>
        <CreateMessageTypeForm lang={language} />
      </div>

    </>
  );
};

export default SendMessagePage;
