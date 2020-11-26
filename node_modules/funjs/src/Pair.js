"use strict";

//patch primitive data types
const {monoidString,monoidArray,empty,append}=require("./Monoid.js")
monoidString(String().__proto__)
monoidArray(Array().__proto__)
const {head,tail,listArray,listString}=require("./List")
listArray(Array().__proto__)
listString(String().__proto__)
const {foldr,foldl,foldMap, foldable}=require("./Foldable")
foldable(Array().__proto__)
foldable(String().__proto__)

class TC_Pair {
  constructor(a,b) {
    this.a=a
    this.b=b
    // this.fst=()=>a
    // this.snd=()=>b
  }
  fst() {return this.a}
  snd() {return this.b}
  map(f) {return Pair(this.fst())(f(this.snd()))}
  append(o) {return Pair(this.fst())(this.snd().append(o))}
  swap() {return Pair(this.snd(),this.fst())}
  mbind(f) {return f(this)}
}

//pairs can construct with (a,b) or (a)(b) (curryed), courtesy of js
const Pair=(a,b)=>typeof b==="undefined"?c=>new TC_Pair(a,c):new TC_Pair(a,b)

exports.Pair=Pair
exports.fst=o=>o.fst()
exports.snd=o=>o.snd()
// exports.mbind=o=>o.mbind
