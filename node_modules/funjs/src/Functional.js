"use strict";
// const{log}=require("../debug")

//some pure functional utilities

exports.id=o=>o
exports.constant=o=>_=>o
exports.flip=f=>a=>b=>f(b)(a)
const arrayCons=(o,oo)=>(oo.unshift(o),oo)
const stringCons=(o,oo)=>o+oo
const cons=(o,oo)=>oo.unshift?arrayCons(o,oo):stringCons(o,oo)
exports.cons=(o,oo)=>typeof oo==="undefined"?oos=>cons(o,oos):cons(o,oo)

//function composition in js style (multiple arguments)
function fc(fs) {
  return function(o) {return fs.length?fs.shift()(fc(fs)(o)):o}
}

exports.fcomp=f=>g=>o=>f(g(o))
exports.fchain=(...fs)=>fc(fs)
