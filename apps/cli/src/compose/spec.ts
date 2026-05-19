export interface LoggingOption {
  driver: string;
  options: Record<string, string>;
}

export interface ServiceSpec {
  image: string;
  healthcheck?: {
    test: string | string[];
    interval?: string;
    timeout?: string;
    retries?: number;
    start_period?: string;
  };
  restart: string;
  ports: string[];
  volumes: string[];
  environment: string[];
  depends_on?: string[] | Record<string, { condition: "service_healthy" }>;

  logging?: LoggingOption;
}
