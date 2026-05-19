import { ErrorBoundaryContentProps } from "src/components/ErrorBoundary";
import { BaseLayout } from "src/layouts/base/BaseLayout";
import { ServerErrorPage } from "src/layouts/error/ServerErrorPage";

export const RootErrorContent: React.FC<ErrorBoundaryContentProps> = () => {
  return (
    <BaseLayout>
      <ServerErrorPage />
    </BaseLayout>
  );
};
