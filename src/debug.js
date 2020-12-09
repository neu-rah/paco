"use strict";

const debuging=true

if (debuging) console.log("DEBUG -------------")

exports.clog=function() {return debuging?console.log.apply(null,arguments):undefined}
exports.log=(o,p)=>typeof p==="undefined"?p=>(console.log(o,p),p):(console.log(o,p),p)
exports.xlog=(x,p)=>typeof p==="undefined"?p=>(console.log(x(p)),p):(console.log(x(p)),p)
exports.debuging=debuging