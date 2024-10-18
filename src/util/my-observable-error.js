/**
 * ## Observable
 * ---
 * 取消观察订阅的错误处理
 */
export class UnSubscriptionError extends Error {
    /**
     * @param {any[]} errors 
     * @constructor
     */
    constructor(errors) {
        const ErrText = `sybscription err: ${errors.map((_, i) => `${i + 1}) ${errors.toString()}`).join('\n  ')}`;
        super(ErrText);
        this.name = UnSubscriptionError.name;
    }
}
