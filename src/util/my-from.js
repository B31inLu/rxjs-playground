import { MyObservable, MySubscriber } from "./my-observable.js";
import { isAsyncIterable, isArrayLike, isInteropObservable, isReadableStreamLike, isPromise, isIterable, isFunction } from './util.js';

/**
 * @template T
 * @typedef {(MyObservable<T>|import('./util').InteropObservable<T>|AsyncIterable<T>|PromiseLike<T>|ArrayLike<T>|Iterable<T>)} ObservableInput
 */

/**
 * @enum {number}
 * @readonly
 */
const ObservableInputType = {
    /**@readonly */
    Own: 1,
    /**@readonly */
    InteropObservable: 2,
    /**@readonly */
    ArrayLike: 3,
    /**@readonly */
    Promise: 4,
    /**@readonly */
    AsyncIterable: 5,
    /**@readonly */
    Iterable: 6,
    /**@readonly */
    ReadableStreamLike: 7,
}

/**
 * @template T
 * @param {ObservableInput<T>} input
 * @return {MyObservable<T>}
 */
export function MyFrom(input) {
    /**
     * 获取当前input的类型
     */
    const type = getObservableInputType(input);
    switch (type) {
        case ObservableInputType.Own:
            return input;
        case ObservableInputType.InteropObservable:
            return fromInteropObservable(input);
        case ObservableInputType.ArrayLike:
            return fromArrayLike(input);
        case ObservableInputType.Promise:
            return fromPromise(input);
        case ObservableInputType.AsyncIterable:
            return fromAsyncIterable(input);
        case ObservableInputType.Iterable:
            return fromIterable(input);
        case ObservableInputType.ReadableStreamLike:
            return fromReadableStreamLike(input);
    }
}

/**
 * @param {unknown} input 
 * @returns {ObservableInputType}
 */
function getObservableInputType(input) {
    if (input instanceof MyObservable) {
        return ObservableInputType.Own;
    }
    if (isInteropObservable(input)) {
        return ObservableInputType.InteropObservable;
    }
    if (isArrayLike(input)) {
        return ObservableInputType.ArrayLike;
    }
    if (isPromise(input)) {
        return ObservableInputType.Promise;
    }
    if (isAsyncIterable(input)) {
        return ObservableInputType.AsyncIterable;
    }
    if (isIterable(input)) {
        return ObservableInputType.Iterable;
    }
    if (isReadableStreamLike(input)) {
        return ObservableInputType.ReadableStreamLike;
    }
    throw new TypeError(
        `You provided ${input !== null && typeof input === 'object' ? 'an invalid object' : `'${input}'`
        } where a stream was expected. You can provide an Observable, Promise, ReadableStream, Array, AsyncIterable, or Iterable.`
    );
}

/**
 * @param {import('./my-observable.js').MyObservable} obj 
 * @returns {MyObservable<T>}
 */
function fromInteropObservable(obj) {
    return new MyObservable((sub) => {
        const obs = obj[Symbol.observable ?? '@@observable']();
        if (isFunction(obs.subscribe)) return obs.subscribe(sub);
        throw new TypeError('没有标记类型Symbol.observable');
    })
}

/**
 * @template T
 * @param {ArrayLike<T>} array 
 * @returns {MyObservable<T>}
 */
function fromArrayLike(array) {
    return new MyObservable((sub) => {
        array.forEach((item) => {
            if (sub.closed) return;
            sub.next(item);
        });
        sub.complete();
    })
}

/**
 * @template T
 * @param {PromiseLike<T>} promise 
 * @returns {MyObservable<T>}
 */
function fromPromise(promise) {
    return new MyObservable((sub) => {
        promise.then(
            (value) => {
                if (sub.closed) return;
                sub.next(value);
                sub.complete();
            },
            (err) => sub.error(err),
        ).then(null, (e) => { console.error('promise like Error'); throw e })
    })
}

/**
 * @template T
 * @param {AsyncIterable<T>} asyncIterable 
 */
function fromAsyncIterable(asyncIterable) {
    /**
     * A side-effect may have closed our subscriber,
     * check before the next iteration.
     * 
     * ---
     * sub.next 的副作用可能关闭了我们的订阅，在迭代前检查是否关闭。
     * 
     * @template T
     * @param {AsyncIterable<T>} asyncIterable 
     * @param {MySubscriber<T>} subscriber 
     */
    const process = async (asyncIterable, subscriber) => {
        for await (const value of asyncIterable) {
            subscriber.next(value);
            if (subscriber.closed) return;
        }
        subscriber.complete();
    }
    return new MyObservable((sub) => {
        process(asyncIterable, sub).catch(e => sub.error(e));
    })
}

/**
 * @template T
 * 
 * 
 * @typedef {{[Symbol.iterator]():Iterator<T>}} Iterable
 * @param {Iterable<T>} iterable 
 */
function fromIterable(iterable) {
    return new MyObservable((sub) => {
        for (const val of iterable) {
            sub.next(val);
            if (sub.closed) return;
        }
        sub.complete();
    })
}

/**
 * @template T
 * @param {ReadableStream<T>} readableStream 
 */
function fromReadableStreamLike(readableStream) {

    /**
     * @template T
     * @param {ReadableStream<T>} readableStream 
     */
    async function* readableStreamLikeToAsyncGenerator(readableStream) {
        const reader = readableStream.getReader();

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) return;
                yield value;
            }
        } finally {
            reader.releaseLock();
        }
    }

    return fromAsyncIterable(readableStreamLikeToAsyncGenerator(readableStream))
}
