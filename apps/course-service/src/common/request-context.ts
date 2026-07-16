import { AsyncLocalStorage } from 'async_hooks';

export type RequestContext = {
  requestId: string;
  actorUserId?: string;
  actorRole?: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(
  context: RequestContext,
  callback: () => T,
): T => requestContextStorage.run(context, callback);

export const getCurrentRequestContext = (): RequestContext | undefined =>
  requestContextStorage.getStore();
