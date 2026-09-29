/**
 * Domain errors. Services throw these; the error middleware is the only place
 * that turns them into HTTP responses, so services stay HTTP-agnostic while
 * still expressing what went wrong precisely.
 *
 * Fields are declared and assigned explicitly rather than through constructor
 * parameter properties: Node runs these sources by stripping types, and
 * parameter properties need a real transform (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX).
 */
export abstract class DomainError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400 — the request itself is malformed. */
export class ValidationError extends DomainError {
  public readonly statusCode: number = 400;
  public readonly code: string = 'VALIDATION_ERROR';

  public constructor(message: string) {
    super(message);
  }
}

/** 404 — the referenced entity does not exist. */
export class NotFoundError extends DomainError {
  public readonly statusCode: number = 404;
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** 409 — the request conflicts with existing state. */
export class ConflictError extends DomainError {
  public readonly statusCode: number = 409;
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
