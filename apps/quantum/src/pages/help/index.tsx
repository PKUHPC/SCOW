import { App, Button, Spin, Typography } from "antd";
import React from "react";
import Markdown from "react-markdown";
import { Head } from "src/components/head";
import { Localized, useI18n, useI18nTranslateToString } from "src/i18n";
import { BASE_PATH } from "src/utils/processEnv";
import { trpc } from "src/utils/trpc";

import cn from "./cn.md";

const { Title, Paragraph } = Typography;

const SdkTokenSection = () => {
  const { data, isLoading, isError, error, isSuccess } = trpc.backend.token.getUserToken.useQuery();
  const { message } = App.useApp();
  const i18n = useI18n();

  const copyToClipboard = async (text: string) => {
    // Try the modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        message.success(i18n.translateToString("help.token.copied"));
        return;
      } catch (err) {
        console.error("Failed to copy with navigator.clipboard: ", err);
        // Fallback will be attempted below
      }
    }

    // Fallback to the legacy method
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      // Make the textarea invisible
      textArea.style.position = "absolute";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      message.success(i18n.translateToString("help.token.copied"));
    } catch (err) {
      console.error("Fallback copy method failed: ", err);
      message.error("Failed to copy token.");
    }
  };


  return (
    <Paragraph>
      <span>SDK Token: </span>
      {
        isLoading ? (
          <Spin><Localized id="help.token.loading" /></Spin>
        ) : isError ? (
          <span><Localized id="help.token.error" />: {error.message}</span>
        ) : (!isSuccess) ? (
          <span><Localized id="help.token.error" /></span>
        ) : (
          <Button onClick={() => copyToClipboard(data.token)}>
            <Localized id="help.token.copy" />
          </Button>
        )
      }
    </Paragraph>
  );
};

const HelpMarkdownLoader = () => {
  // markdown中导入BASE_PATH
  const processedMarkdown = BASE_PATH !== "/" ? cn.replace(/\{\{BASE_PATH\}\}/g, BASE_PATH) :
    cn.replace(/\{\{BASE_PATH\}\}/g, "");

  // TODO 不同语言选择不同的markdown文件
  return (
    <Markdown
      components={{
        h1: ({ node, ...props }) => <Title level={1} {...props} />,
        h2: ({ node, ...props }) => <Title level={2} {...props} />,
        h3: ({ node, ...props }) => <Title level={3} {...props} />,
        p: ({ node, ...props }) => <Paragraph {...props} />,
      }}
    >
      {processedMarkdown}
    </Markdown>
  );
};

const HelpPage = () => {
  const t = useI18nTranslateToString();
  return (
    <Typography>
      <Head title={t("help.title")} />
      <Title>
        <Localized id="help.title" />
      </Title>
      <SdkTokenSection />
      <HelpMarkdownLoader />
    </Typography>
  );
};

export default function AppWrapper() {
  return (
    <App>
      <HelpPage />
    </App>
  );
}
