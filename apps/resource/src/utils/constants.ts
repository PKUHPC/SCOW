export const PRODUCTION_CONFIG_BASE_PATH = "/etc/scow";

export const DEFAULT_CONFIG_BASE_PATH = process.env.SCOW_CONFIG_PATH
?? (process.env.NODE_ENV === "production" ? PRODUCTION_CONFIG_BASE_PATH : "config");

// DEFAULT_PAGE_SIZE FOR RESOURCE
export const DEFAULT_PAGE_SIZE = 10;

// DEFAULT ERROR MESSAGE IN RESOURCE SYSTEM
export const DEFAULT_ERROR_MESSAGE = "Please confirm the error details in resource log.";
