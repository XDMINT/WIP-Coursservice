import {
  FindOptionsOrder,
  FindOptionsRelations,
  FindOptionsWhere,
  ILike,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';

export type DeleteResultPort = {
  affected?: number | null;
};

export type QueryOperatorName =
  | 'in'
  | 'not'
  | 'isNull'
  | 'lessThanOrEqual'
  | 'moreThanOrEqual'
  | 'ilike';

export type QueryOperator = {
  kind: QueryOperatorName;
  value?: unknown;
};

export type QueryWhere<T> = Partial<{
  [K in keyof T]: T[K] | QueryOperator | QueryWhere<T[K]>;
}> | Array<Partial<{
  [K in keyof T]: T[K] | QueryOperator | QueryWhere<T[K]>;
}>>;

export type QueryOrder<T> = Partial<Record<keyof T, 'ASC' | 'DESC' | 'asc' | 'desc'>>;

export type QueryOptions<T> = {
  where?: QueryWhere<T>;
  relations?: string[] | Record<string, unknown>;
  order?: QueryOrder<T> | Record<string, unknown>;
  skip?: number;
  take?: number;
};

export interface EntityRepositoryPort<T> {
  find(options?: QueryOptions<T>): Promise<T[]>;
  findOne(options: QueryOptions<T>): Promise<T | null>;
  save(entity: T): Promise<T>;
  save(entity: T[]): Promise<T[]>;
  delete(criteria: unknown): Promise<DeleteResultPort>;
  count(options?: QueryOptions<T>): Promise<number>;
}

const isQueryOperator = (value: unknown): value is QueryOperator =>
  Boolean(
    value
      && typeof value === 'object'
      && 'kind' in value
      && typeof (value as QueryOperator).kind === 'string',
  );

const toTypeOrmValue = (value: unknown): unknown => {
  if (isQueryOperator(value)) {
    switch (value.kind) {
      case 'in':
        return In(Array.isArray(value.value) ? value.value : []);
      case 'not':
        return Not(toTypeOrmValue(value.value));
      case 'isNull':
        return IsNull();
      case 'lessThanOrEqual':
        return LessThanOrEqual(value.value as any);
      case 'moreThanOrEqual':
        return MoreThanOrEqual(value.value as any);
      case 'ilike':
        return ILike(String(value.value ?? ''));
      default:
        return value.value;
    }
  }

  if (Array.isArray(value)) {
    return value.map(toTypeOrmValue);
  }

  if (
    value
    && typeof value === 'object'
    && !(value instanceof Date)
    && !(value instanceof Buffer)
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        toTypeOrmValue(nestedValue),
      ]),
    );
  }

  return value;
};

const toTypeOrmOptions = <T>(
  options?: QueryOptions<T>,
): {
  where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
  relations?: FindOptionsRelations<T> | string[];
  order?: FindOptionsOrder<T>;
  skip?: number;
  take?: number;
} | undefined => {
  if (!options) {
    return undefined;
  }

  return {
    ...options,
    where: toTypeOrmValue(options.where) as FindOptionsWhere<T> | FindOptionsWhere<T>[],
    relations: options.relations as FindOptionsRelations<T> | string[] | undefined,
    order: options.order as FindOptionsOrder<T> | undefined,
  };
};

export class TypeOrmEntityRepositoryAdapter<T> implements EntityRepositoryPort<T> {
  constructor(private readonly repository: Repository<T>) {}

  find(options?: QueryOptions<T>): Promise<T[]> {
    return this.repository.find(toTypeOrmOptions(options));
  }

  findOne(options: QueryOptions<T>): Promise<T | null> {
    return this.repository.findOne(toTypeOrmOptions(options) ?? {});
  }

  save(entity: T): Promise<T>;
  save(entity: T[]): Promise<T[]>;
  save(entity: T | T[]): Promise<T | T[]> {
    return this.repository.save(entity as any) as Promise<T | T[]>;
  }

  delete(criteria: unknown): Promise<DeleteResultPort> {
    return this.repository.delete(criteria as any);
  }

  count(options?: QueryOptions<T>): Promise<number> {
    return this.repository.count(toTypeOrmOptions(options));
  }
}
