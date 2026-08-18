import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthenticationGuard } from "src/app/AuthenticationGuard";
import { AppLayout } from "src/app/layout/AppLayout";
import { routeModuleDefinitions } from "src/app/router/modules";
import { ProfilePage } from "src/features/profile";
import { DashboardPage } from "src/pages/DashboardPage";
import { FilesPage } from "src/pages/FilesPage";
import { ModuleLandingPage } from "src/pages/ModuleLandingPage";
import { NotFoundPage } from "src/pages/NotFoundPage";

const NotificationRoutes = lazy(() =>
  import("src/features/notification/NotificationRoutes").then((module) => ({ default: module.NotificationRoutes })),
);

const ExtensionPage = lazy(() =>
  import("src/features/uiExtension").then((module) => ({ default: module.ExtensionPage })),
);

export function App() {
  return (
    <Routes>
      <Route element={<AuthenticationGuard />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate replace to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/files/*" element={<FilesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/extensions/*"
            element={
              <Suspense fallback={null}>
                <ExtensionPage />
              </Suspense>
            }
          />
          <Route
            path="/notification/*"
            element={
              <Suspense fallback={null}>
                <NotificationRoutes />
              </Suspense>
            }
          />
          {routeModuleDefinitions.map((module) => (
            <Route key={module.id} path={`${module.path}/*`} element={<ModuleLandingPage module={module} />} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
