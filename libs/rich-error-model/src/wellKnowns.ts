import {
  BadRequest,
  BadRequest_FieldViolation,
  DebugInfo,
  ErrorInfo,
  Help,
  LocalizedMessage,
  PreconditionFailure,
  PreconditionFailure_Violation,
  QuotaFailure,
  QuotaFailure_Violation,
  ResourceInfo,
  RetryInfo,
} from "src/generated/error_details";
import { Any } from "src/generated/google/protobuf/any";

export const KnownMessages = [
  BadRequest,
  BadRequest_FieldViolation,
  DebugInfo,
  ErrorInfo,
  Help,
  LocalizedMessage,
  PreconditionFailure,
  PreconditionFailure_Violation,
  QuotaFailure,
  QuotaFailure_Violation,
  ResourceInfo,
  RetryInfo,
] as const;

export type ErrorDetail =
  | BadRequest
  | BadRequest_FieldViolation
  | DebugInfo
  | ErrorInfo
  | Help
  | LocalizedMessage
  | PreconditionFailure
  | PreconditionFailure_Violation
  | QuotaFailure
  | QuotaFailure_Violation
  | ResourceInfo
  | RetryInfo
  | Any;

export {
  BadRequest,
  BadRequest_FieldViolation,
  DebugInfo,
  ErrorInfo,
  Help,
  LocalizedMessage,
  PreconditionFailure,
  PreconditionFailure_Violation,
  QuotaFailure,
  QuotaFailure_Violation,
  ResourceInfo,
  RetryInfo,
};
