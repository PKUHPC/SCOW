import { getCurrentLanguageId } from "@scow/lib-web/build/utils/systemLanguage";
import { GetServerSideProps, NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { useI18nTranslateToString } from "src/i18n";
import { SubmitJobForm } from "src/pageComponents/job/SubmitJobForm";
import { getServerI18nConfigText, publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";

interface Props {
  submitJobPromptText: string;
}

export const SubmitJobPage: NextPage<Props> = requireAuth(() => true)(
  (props: Props) => {
    const t = useI18nTranslateToString();

    return (
      <div>
        <Head title={t("pages.jobs.submit.title")} />
        <SubmitJobForm submitJobPromptText={props.submitJobPromptText} />
      </div>
    );

  });

export const getServerSideProps: GetServerSideProps = async ({ req }) => {

  const languageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);
  const submitJobPromptText = getServerI18nConfigText(languageId, "submitJopPromptText");

  return {
    props: {
      submitJobPromptText,
    },
  };
};

export default SubmitJobPage;
