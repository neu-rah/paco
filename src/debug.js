"use strict";

var debugging=process.env.NODE_DEV

if (debugging) console.log("DEBUG -------------")

const clog=function() {return debugging?console.log.apply(null,arguments):undefined}
exports.clog=clog
exports.log=(o,p)=>typeof p==="undefined"?p=>(clog(o,p),p):(clog(o,p),p)
exports.xlog=(m,x,p)=>typeof p==="undefined"?p=>(clog(m,x(p)),p):(clog(m,x(p)),p)
exports.debugging=debugging