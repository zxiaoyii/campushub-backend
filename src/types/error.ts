export interface ErrorPayload {
  readonly code: string;
  readonly message: string;
}

export interface ErrorResponse {
  readonly error: ErrorPayload;
}
