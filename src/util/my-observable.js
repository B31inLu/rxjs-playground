import { isFunction } from "./util.js";
import { UnSubscriptionError } from './my-observable-error.js';

Symbol.for('@@observable');

/**
 * 取消订阅接口
 * @typedef UnSubscribe
 * @type {Object}
 * @property {(()=>void)} unsubscribe
 */

/**
 * 取消订阅类型接口
 * @typedef { UnSubscribe & {closed: boolean}} UnSubscribeLike
 */

/**
 * ### 观察者接口
 * @typedef Observer
 * @type {Object}
 * @property {(vlaue)=>void} next
 * @property {(error)=>void} error
 * @property {()=>void} complete
 */

/**
 * ### 订阅观察者接口
 * @typedef {Partial<Observer & {finalize:()=>void}>} SubscriberOverrides
 */

/**
 * ### 订阅者接口
 * @template T
 * @typedef Subscribable
 * @property {(observer:Partial<Observer>)=>UnSubscribe} subscribe
 */

/**
 * ### 订阅操作类
 * ---
 * 最小执行单元
 * 
 * e.g. sub.next(1); sub.error(err); ...
 * @implements {UnSubscribeLike}
 */
export class MySubscription {

    closed = false;
    /**@type {?(()=>void)} */
    initialTeardown;

    /**
     * @type {(?Set<MySubscription|UnSubscribe|(()=>void)>)}
     */
    #finalizers = null;

    static EMPTY = (() => {
        const empty = new MySubscription();
        empty.closed = true;
        return empty;
    })();

    /**
     * @param {?(()=>void)} initialTeardown 
     */
    constructor(initialTeardown) {
        this.initialTeardown = initialTeardown;
    }

    unsubscribe() {
        /**@type {?any[]} */
        let errors;
        if (this.closed) return;
        this.closed = true;
        if (isFunction(this.initialTeardown)) {
            try {
                this.initialTeardown();
            } catch (e) {
                errors = e instanceof UnSubscriptionError ? e.errors : [e];
            }
        }

        const finalizers = this.#finalizers;
        if (finalizers) {
            this.#finalizers = null;
            for (const finalizer of finalizers) {
                try {
                    isFunction(finalizer) ? finalizer() : finalizer.unsubscribe();
                } catch (e) {
                    errors ??= [];
                    errors.push(...(e instanceof UnSubscriptionError ? e.errors : [e]));
                }
            }
        }
        if (errors) {
            throw new UnSubscriptionError(errors);
        }
    }

    /**
     * ### 添加订阅链
     * ---
     * 添加指向执行下一个订阅的方法
     * @param {(void|MySubscription|UnSubscribe|(()=>void))} teardown 
     * @returns
     */
    add(teardown) {
        if (!(teardown && (teardown !== this)) || !this.closed) return;
        isFunction(teardown) ? teardown() : teardown.unsubscribe();
    }
}

/**
 * ### 订阅者类
 * 
 * @template T
 * @class
 * @implements {Observer} 
 * @extends MySubscription
 */
export class MySubscriber extends MySubscription {

    #isStopped = false;

    /**@type {?(()=>void)} */
    #onFinalize = null;

    /**@type {Observer} */
    #destination;

    /**
     * 
     * @param {?(MySubscriber|Observer|((value)=>void))} destination 
     * @param {?SubscriberOverrides} overrides 
     */
    constructor(destination, overrides) {
        super();
        this.#destination = destination instanceof MySubscriber ? destination : this.#createSaveObserver(destination);
        this.#onFinalize = overrides?.finalize ?? null;
        const isCheckHasAddAndUnsubscribe = destination && isFunction(destination.unsubscribe) && isFunction(destination.add);
        if (isCheckHasAddAndUnsubscribe) destination.add(this);
    }

    /**
     * 创建安全观察者
     * 
     * @param {?(Observer|(value)=>void)} observerOrNext 
     */
    #createSaveObserver(observerOrNext) {
        const isCheck = !observerOrNext || isFunction(observerOrNext);
        const result = isCheck ? { next: observerOrNext ?? undefined } : observerOrNext;
        return new ComsumerObserver(result);
    }

    next(value) {
        if (!this.#isStopped) this.#destination.next(value);
    }

    error(err) {
        if (!this.#isStopped) {
            this.#isStopped = true;
            try {
                this.#destination.error(err);
            } finally {
                this.unsubscribe();
            }
        }
    }

    complete() {
        if (!this.#isStopped) {
            this.#isStopped = true;
            try {
                this.#destination.complete();
            } finally {
                this.unsubscribe();
            }
        }
    }

    unsubscribe() {
        if (this.closed) {
            this.#isStopped = true;
            super.unsubscribe();
            this.#onFinalize?.();
        }
    }
}

/**
 * ### 消费观察者
 * ---
 * 消费观察者中的next由订阅者创建的方法/函数/资源
 * 
 * @class
 * @implements {Observer}
 */
class ComsumerObserver {
    /**
     * @param {Partial<Observer>} partialObserver 
     */
    constructor(partialObserver) {
        this.partialObserver = partialObserver;
    }

    next(value) {
        const { partialObserver } = this;
        if (partialObserver.next) {
            try {
                partialObserver.next(value);
            } catch (e) {
                throw e;
            }
        }
    }

    error(error) {
        const { partialObserver } = this;
        if (partialObserver.error) {
            try {
                partialObserver.error(error);
            } catch (e) {
                throw e;
            }
        } else {
            throw error;
        }
    }

    complete() {
        const { partialObserver } = this;
        if (partialObserver.complete) {
            try {
                partialObserver.complete();
            } catch (e) {
                throw e;
            }
        }
    }
}


/**
 * ### 观察者类
 * ---
 * rxjs 最小单元
 * @template T
 * @implements {Subscribable}
 */
export class MyObservable {
    /**
     * @param {(((this:MyObservable,subscriber:MySubscriber)=>MySubscription|UnSubscribe|(() => void)|void)|(() => void)|void)} subscribe 
     */
    constructor(subscribe) {
        this.#subscribe = subscribe;
    }

    /**@type {MySubscriber} */
    #subscribe;

    /**
     * observer 就是执行next的回调方法
     * @param {?(Partial<Observer>|(value)=>void)} observer 
     */
    subscribe(observer) {
        const sub = observer instanceof MySubscriber ? observer : new MySubscriber(observer);
        sub.add(this.#trySubscribe(sub));
        return sub;
    }

    /**
     * @param {MySubscriber} sink 
     */
    #trySubscribe(sink) {
        try {
            return this.#subscribe(sink);
        } catch (e) {
            sink.error(e);
        }
    }

    /**
     * @param {(value)=>void} next 
     * @returns {Promise<void>}
     */
    forEach(next) {
        return new Promise((resolve, reject) => {
            const sub = new MySubscriber({
                next: (val) => {
                    try {
                        next(val);
                    } catch (e) {
                        reject(e);
                        sub.unsubscribe();
                    }
                },
                error: reject,
                complete: resolve
            })
            this.subscribe(sub);
        })
    }

    /**
     * @param  {{(source):any}[]} operations 
     * @returns {MyObservable}
     */
    pipe(...operations) {
        return operations.reduce((prev, fn) => fn(prev), this);
    }

    /**
     * 标记点,用于判断当前 class 是否为 observable 类型
     * @returns 
     */
    [Symbol.observable ?? '@@observable']() {
        return this;
    }

    /**
     * ### 实现异步可迭代对象
     * @template T
     * @returns {(AsyncGenerator<T,void,void>|unknown)}
     */
    [Symbol.asyncIterator]() {

        /**@type {(MySubscription|undefined)} */
        let subscription;

        let hasError = false;
        let completed = false;

        /**@type {unknown} */
        let error;

        /**@type {T[]} */
        const values = [];

        /**
         * @type {[(value)=>void,(reason:unknown)=>void][]}
         */
        const deferreds = [];

        /**
         * 
         * @param {unknown} err 
         */
        const handleError = (err) => {
            hasError = true;
            error = err;
            while (deferreds.length) {
                const [_, reject] = deferreds.shift();
                reject(err);
            }
        }

        const handleComplete = () => {
            completed = true;
            while (deferreds.length) {
                const [resolve] = deferreds.shift();
                resolve({ value: undefined, done: true });
            }
        }
        return {
            /**
             * 
             * @returns {Promise}
             */
            next: () => {
                if (!subscription) {
                    subscription = this.subscribe({
                        next: (val) => {
                            if (deferreds.length) {
                                const [resolve] = deferreds.shift();
                                resolve({ value: val, done: false });
                            } else {
                                values.push(val);
                            }
                        },
                        error: handleError,
                        complete: handleComplete,
                    })
                }

                if (values.length) {
                    return Promise.resolve({ value: values.shift(), done: false })
                }

                if (completed) {
                    return Promise.resolve({ value: undefined, done: true })
                }

                if (hasError) {
                    return Promise.reject(error);
                }

                return new Promise((res, rej) => {
                    deferreds.push([res, rej]);
                })
            },
            /**
             * @param {unknown} err 
             * @returns {Promise}
             */
            throw: (err) => {
                subscription?.unsubscribe();
                handleError();
                return Promise.reject(err);
            },
            /**
             * @returns {Promise}
             */
            return: () => {
                subscription?.unsubscribe();
                handleComplete();
                return Promise.resolve({ value: undefined, done: true })
            },
            [Symbol.asyncIterator]() {
                return this;
            }
        }

    }
} 