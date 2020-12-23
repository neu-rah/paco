"use strict";

var it=exports?global:this
if(!exports) var exports={}

Object.assign(it,require("./src/debug"))
Object.assign(it,require("./paco"))

///////////////////////////////////////////////////////////////////////////////////////////////////
// benchmark basics
const runn=cnt=>function run(name,src,mute) {
  const p=src.fst()
  p.optimize()
  var io=Pair([],src.snd())
  var start=new Date()
  for(var n=0;n<cnt;n++) p.parse(io)
  var end=new Date()
  if(!mute) console.log(name,((end-start)*1000/cnt).toString().padStart(5),"us",p.parse(io))
}

function runTests(n,tests) {
  clog("benchmark ---------------------------------------------------------------------")
  clog("--",new Date(),n)
  const run=runn(n)
  const heat=runn(n/100)
  for(var r=0;r<100;r++)
    for(var n of tests)
      heat(n.fst(),n.snd(),true)
  for(var n of tests) {
    run(n.fst(),n.snd())
  }
}

exports.runTests=runTests

/////////////////////////////////////////////////////////////////////////////////
// testing
const tests=[
  Pair("string................:",Pair(string("ok"),"ok")),
  Pair("skip/join/then........:",Pair(letter.skip(digits.join()).then(letter),"a123X...")),
  Pair("many ok...............:",Pair(many(digit),"21...")),
  Pair("many empty............:",Pair(many(digit),"...")),
  Pair("some ok...............:",Pair(some(digit),"21...")),
  Pair("endBy.................:",Pair(endBy1(digit,space),"1 2 3 ")),
  Pair("endBy join............:",Pair(endBy1(digit,space).join(),"1 2 3 ")),
  Pair("digits then digit.....:",Pair(digits.join().then(digit),"123")),
  Pair("int then digit........:",Pair(digits.join().as(parseInt).then(digit),"123")),
]

runTests(100000,tests)