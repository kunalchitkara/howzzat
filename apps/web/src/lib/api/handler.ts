import { handleApiError } from "./http";

type RouteContext<T extends Record<string, string> = Record<string, string>> = {
  params: Promise<T>;
};

export function withApi<T extends Record<string, string>>(
  handler: (request: Request, context: RouteContext<T>) => Promise<Response>,
) {
  return async (request: Request, context: RouteContext<T>) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
