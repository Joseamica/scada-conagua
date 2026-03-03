export {};

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: number;
      role_id: number;
      scope: string;
      scope_id: number;
      estado_id: number;
    };
  }
}
