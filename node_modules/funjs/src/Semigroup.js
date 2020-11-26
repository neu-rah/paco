"use strict";

const {fcomp}=require("./Functional")

exports.semigroupFunction=o=>{
  o.append=function(p) {return fcomp(this,p)}
}

exports.semigroupString=o=>{
  o.append=function(p) {return this+p}
}

exports.semigroupArray=o=>{
  o.append=function(p) {return this.concat(p)}
}

exports.semigroupFunction(Function().__proto__)
exports.semigroupString(String().__proto__)
exports.semigroupArray(Array().__proto__)

exports.append=a=>b=>a.append(b)

