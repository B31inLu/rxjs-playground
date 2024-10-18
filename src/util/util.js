/**
 * @template T
 * @typedef InteropObservable<T>
 * @property {(() => Subscribable<T>)} [Symbol.observable]
 */

/**
 * @param {any} val 
 * @returns {val is (...args:any[])=>any}
 */
export function isFunction(val) {
    return typeof val === 'function';
}

// /**
//  * @template T
//  * @param {*} obj 
//  * @returns {obj is AsyncIterable<T>}
//  */
// export function isAsyncIterable(obj) {
//     return Symbol.asyncIterator && isFunction(obj?.[Symbol.asyncIterator]);
// }

/**
 * @template T
 * @param {any} value 
 * @returns {input is InteropObservable<T>}
 */
export function isInteropObservable(value) {
    return isFunction(value[Symbol.observable ?? '@@observable']);
}

/**
 * @template T
 * @param {*} likeArray
 * @returns {likeArray is ArrayLike<T>}
 */
export function isArrayLike(likeArray) {
    return likeArray && typeof likeArray.length === 'number' && !isFunction(likeArray);
}

/**
 * @template T
 * @param {*} value 
 * @return {value is PromiseLike<T>}
 */
export function isPromise(value) {
    return isFunction(value?.then);
}

/**
 * @template T
 * @param {*} value 
 * @returns {value is AsyncIterable<T>}
 */
export function isAsyncIterable(value) {
    return Symbol.asyncIterator && isFunction(value?.[Symbol.asyncIterator]);
}

/**
 * @template T
 * @param {*} value 
 * @returns {value is Iterable<T>}
 */
export function isIterable(value) {
    return isFunction(value?.[Symbol.iterator]);
}

/**
 * @template T
 * @param {*} value 
 * @returns {value is ReadableStream<T>}
 */
export function isReadableStreamLike(value) {
    return isFunction(value?.getReader);
}
