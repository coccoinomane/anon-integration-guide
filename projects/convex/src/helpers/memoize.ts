/**
 * Decorator that memoizes/caches the results of an async method
 * call to avoid redundant work.
 *
 * This is a static-cache implementation where the cache is shared
 * across all instances of the class. You can optionally provide a
 * custom cache key function.
 *
 * Potential pitfalls, not relevant for our use case:
 * 1. Pending Promise Race Condition: If the decorated method is called
 *    concurrently with the same arguments, the original function is not
 *    cached until it finishes executing, potentially triggering
 *    duplicate API calls.
 * 2. Shared Cache Across Instances: The cache is defined in the decorator
 *    closure and is shared across all instances, which can lead to
 *    unintended behavior if different instances (e.g. differing by a
 *    constructor parameter) should have separate cache entries.
 */
export function staticMemoize(cacheKeyFn?: (...args: any[]) => string) {
    const cache = new Map<string, any>();

    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const key = cacheKeyFn ? cacheKeyFn(...args) : JSON.stringify(args);

            if (cache.has(key)) {
                return cache.get(key);
            }

            const result = await originalMethod.apply(this, args);
            cache.set(key, result);
            return result;
        };

        // Add static method to clear cache
        target.constructor[`clear${propertyKey}Cache`] = () => {
            cache.clear();
        };

        return descriptor;
    };
}
