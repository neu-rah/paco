"use strict";

//because Lists are Monoids
//patch primitive data types
const {cons}=require("./Functional.js")
const {monoidString,monoidArray,empty,append,mconcat}=require("./Monoid.js")
monoidString(String().__proto__)
monoidArray(Array().__proto__)

exports.listArray=o=>{
  o.head=function() {return this[0]}
  o.tail=function() {return this.slice(1)}
  o.mconcat=function(){
    if(this.length==0) return
    return this.length==1?this.head():this.head().append(this.tail().mconcat())
  }
  o.pure=o=>[o]
  o.app=function(p) {
    return (this.length&&p.length)?cons(this.head()(p.head()),this.tail().app(p.tail())):this.empty
  }
}

exports.listString=o=>{
  o.head=function() {return this[0]}
  o.tail=function() {return this.substr(1)}
  o.pure=""
}

exports.listString(String().__proto__)
exports.listArray(Array().__proto__)

exports.head=o=>o.head()
exports.tail=o=>o.tail()
exports.mconcat=o=>o.mconcat()

