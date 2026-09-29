/**
 * components/schemas/ErrorResponse — flat { code, message }, matching
 * docs/openapi.yaml. Every error the API emits uses this shape.
 */
export interface ErrorResponse {
  readonly code: string;
  readonly message: string;
}
