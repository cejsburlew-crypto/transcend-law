// Request parameter narrowing.
//
// @types/express 5 declares ParamsDictionary values as `string | string[]` to
// support wildcard routes, and req.query values as ParsedQs unions. Every route
// in this codebase binds single values, so these helpers narrow explicitly.
//
// Deliberately NOT `String(value)`: String(undefined) yields the string
// "undefined", which would silently reach SQL as a real value. Missing input
// becomes '' here so callers' existing falsy checks catch it.

type RawParam = string | string[] | undefined;
type RawQuery = string | string[] | Record<string, any> | Record<string, any>[] | undefined;

/** Narrow a route parameter (`req.params.x`) to a single string. */
export const routeParam = (value: RawParam): string =>
  Array.isArray(value) ? value[0] ?? '' : value ?? '';

/** Narrow a query-string parameter (`req.query.x`) to a single string. */
export const queryParam = (value: RawQuery): string => {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : '';
  }
  return typeof value === 'string' ? value : '';
};

/** Query parameter parsed as an integer, with a fallback. */
export const queryInt = (value: RawQuery, fallback: number): number => {
  const parsed = parseInt(queryParam(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Query parameter parsed as a boolean ("true"/"1" are true). */
export const queryBool = (value: RawQuery): boolean => {
  const raw = queryParam(value).toLowerCase();
  return raw === 'true' || raw === '1';
};
