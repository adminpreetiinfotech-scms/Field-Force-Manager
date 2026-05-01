export * from "./generated/api";
export * from "./generated/api.schemas";
export { ApiError, setBaseUrl, setAuthTokenGetter, setAdminPhoneGetter } from "./custom-fetch";
export type { AuthTokenGetter, ErrorType } from "./custom-fetch";
