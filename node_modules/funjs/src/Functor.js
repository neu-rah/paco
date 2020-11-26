"use strict";

const { cons } = require("./Functional");

//Functor typeclass methods mapping
const _map=f=>o=>(o.length?cons(f(o.head()),_map(f)(o.tail())):o)
exports.map=f=>o=>o.map?o.map(f):_map(f)(o)
exports.drop=n=>o=>n?this.drop(n-1)(o.tail()):o
