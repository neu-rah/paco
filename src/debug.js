"use strict";

const debugging=process.env.NODE_DEV

if (debugging) console.log("DEBUG -------------")

exports.clog=function() {return debugging?console.log.apply(null,arguments):undefined}
exports.log=(o,p)=>typeof p==="undefined"?p=>(console.log(o,p),p):(console.log(o,p),p)
exports.xlog=(x,p)=>typeof p==="undefined"?p=>(console.log(x(p)),p):(console.log(x(p)),p)
exports.debugging=debugging