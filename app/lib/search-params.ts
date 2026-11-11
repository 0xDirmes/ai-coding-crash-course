/**
 * A copy of `params` with `key` set to `value` and every other param kept.
 * Pass to `setSearchParams((params) => withSearchParam(params, key, value))`.
 */
export function withSearchParam(
  params: URLSearchParams,
  key: string,
  value: string
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set(key, value);
  return next;
}
