import { router } from "src/server/trpc/def";

import {
  createDevHost,
} from "./devHost";

export const devHost = router({
  createDevHost,
});
