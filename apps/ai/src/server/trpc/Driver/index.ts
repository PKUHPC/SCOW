import { withFileDriver } from "./fileDriver/fileDriver";
import { withImageDriver } from "./imageDriver/imageDriver";
import { withJobDriver } from "./jobDriver/jobDriver";

export const driver = {
  withFileDriver,
  withJobDriver,
  withImageDriver,
};

