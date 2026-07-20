import type { CourseDomainFacade } from './course-domain.context';

export abstract class CourseDomainService {
  [key: string]: any;

  readonly api: any;

  constructor(protected readonly courseContext: CourseDomainFacade) {
    this.api = createCourseServiceProxy(this, courseContext);
  }
}

const bindIfFunction = (value: unknown, receiver: unknown): unknown =>
  typeof value === 'function' ? (value as Function).bind(receiver) : value;

export const createCourseServiceProxy = <TDomain extends object>(
  domainService: TDomain,
  courseContext: CourseDomainFacade,
): TDomain & Record<PropertyKey, any> => {
  const delegatedService = courseContext as Record<PropertyKey, any>;

  return new Proxy(domainService as TDomain & Record<PropertyKey, any>, {
    get: (target, property, receiver) => {
      if (property in target) {
        return bindIfFunction(
          Reflect.get(target, property, receiver),
          receiver,
        );
      }

      return bindIfFunction(delegatedService[property], courseContext);
    },
    set: (target, property, value, receiver) => {
      if (property in target) {
        return Reflect.set(target, property, value, receiver);
      }

      delegatedService[property] = value;

      return true;
    },
  });
};
