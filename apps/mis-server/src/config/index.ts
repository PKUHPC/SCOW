import { config } from "./env";
import { misConfig } from "./mis";

export const authUrl = config.AUTH_URL || misConfig.authUrl;
