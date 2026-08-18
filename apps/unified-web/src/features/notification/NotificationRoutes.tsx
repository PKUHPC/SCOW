import { Navigate, Route, Routes } from "react-router-dom";
import { NotificationLayout } from "src/features/notification/NotificationLayout";
import { NotificationMessagesPage } from "src/features/notification/NotificationMessagesPage";
import { NotificationSubscriptionsPage } from "src/features/notification/NotificationSubscriptionsPage";

export function NotificationRoutes() {
  return (
    <Routes>
      <Route element={<NotificationLayout />}>
        <Route index element={<Navigate replace to="messages" />} />
        <Route path="messages" element={<NotificationMessagesPage />} />
        <Route path="subscriptions" element={<NotificationSubscriptionsPage />} />
        <Route path="*" element={<Navigate replace to="messages" />} />
      </Route>
    </Routes>
  );
}
