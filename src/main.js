import { from, Observable } from 'rxjs';
import { MyFrom } from './util/my-from.js';
import { MyObservable } from './util/my-observable.js';

const list1 = [Promise.resolve('promise'), 'string', new Observable((sub) => { sub.next("obs"); sub.complete(); })]
const list2 = [Promise.resolve('promise'), 'string', new MyObservable((sub) => { sub.next("obs"); sub.complete(); })]

const rxjsfrom = from(list1);
const myfrom = MyFrom(list2);

rxjsfrom.subscribe(console.log);
myfrom.subscribe(console.log);