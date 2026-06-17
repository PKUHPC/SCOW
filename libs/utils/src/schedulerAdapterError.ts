export const SCHEDULER_ADAPTER_TIMEOUT_ERROR_MESSAGE = "Scheduler adapter call timed out";

const GRPC_DEADLINE_EXCEEDED_STATUS_CODE = 4;

interface MaybeSchedulerAdapterTimeoutError {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  cause?: unknown;
}

interface MaybeSchedulerAdapterTimeoutPayload extends MaybeSchedulerAdapterTimeoutError {
  schedulerAdapterTimeout?: unknown;
  clusterErrorsArray?: unknown;
}

const isSchedulerAdapterTimeoutMessage = (value: unknown) =>
  typeof value === "string" && value.includes(SCHEDULER_ADAPTER_TIMEOUT_ERROR_MESSAGE);

export const isSchedulerAdapterTimeoutError = (error: unknown): boolean => {
  if (isSchedulerAdapterTimeoutMessage(error)) {
    return true;
  }

  const maybeError = error as MaybeSchedulerAdapterTimeoutError | undefined;

  return (
    maybeError?.code === GRPC_DEADLINE_EXCEEDED_STATUS_CODE ||
    isSchedulerAdapterTimeoutMessage(maybeError?.message) ||
    isSchedulerAdapterTimeoutMessage(maybeError?.details) ||
    (maybeError?.cause ? isSchedulerAdapterTimeoutError(maybeError.cause) : false)
  );
};

export const hasSchedulerAdapterTimeoutError = (data: unknown): boolean => {
  if (isSchedulerAdapterTimeoutError(data)) {
    return true;
  }

  const maybePayload = data as MaybeSchedulerAdapterTimeoutPayload | undefined;
  if (maybePayload?.schedulerAdapterTimeout === true) {
    return true;
  }

  const clusterErrors = maybePayload?.clusterErrorsArray;
  return Array.isArray(clusterErrors) && clusterErrors.some(isSchedulerAdapterTimeoutError);
};
