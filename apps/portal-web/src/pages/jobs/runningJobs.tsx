import { GetServerSideProps } from "next";

/**
 * 保留旧入口，避免已有书签或外部链接失效；作业页面已经统一到作业管理页。
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/jobs/allJobs",
    permanent: false,
  },
});

export default function RunningJobsRedirect() {
  return null;
}
