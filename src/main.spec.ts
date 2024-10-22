import { Observable } from "./rx-observable/observable.ts";

const ob = new Observable((sub) => {
    sub.next('hallo')
    debugger;
    sub.error('world')
    sub.complete()
});

ob.subscribe(val => {
    console.log(val);
    return;
});