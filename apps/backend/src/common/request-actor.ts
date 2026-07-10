import { Request } from 'express';

export type RequestActor = {
  userId?: string;
  globalRoles: string[];
};

const firstHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const firstBodyValue = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
  }

  return undefined;
};

export const getRequestActor = (request: Request): RequestActor => {
  const headers = request.headers;
  const body = request.body as Record<string, unknown> | undefined;
  const query = request.query as Record<string, unknown> | undefined;
  const userHeader =
    firstHeaderValue(headers['x-user-id']) ??
    firstHeaderValue(headers['x-auth-user-id']);
  const globalRolesHeader =
    firstHeaderValue(headers['x-user-roles']) ??
    firstHeaderValue(headers['x-auth-user-roles']);

  return {
    userId: firstBodyValue(
      userHeader,
      query?.actorUserId,
      query?.currentUserId,
      body?.actorUserId,
      body?.currentUserId,
      query?.userId,
      body?.userId,
    ),
    globalRoles:
      globalRolesHeader
        ?.split(',')
        .map((role) => role.trim())
        .filter(Boolean) ?? [],
  };
};
