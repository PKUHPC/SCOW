import axios from "axios";
import { getScowPath } from "src/config/runtime";
import type { ModuleId } from "src/shared/module";

export const getDomainApiBase = (domain: ModuleId) => getScowPath(`/api/unified/${domain}`);

export const createRestClient = (domain: ModuleId) =>
  axios.create({
    baseURL: getDomainApiBase(domain),
    withCredentials: true,
  });
