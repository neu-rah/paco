"use strict";

var it=exports?global:this
if(!exports) var exports={}

Object.assign(it,require("./debug"))

///////////////////////////////////////////////////////////////////////////////////////////////////
// benchmark basics
const runn=cnt=>function run(name,src,mute) {
  var start=new Date()
  for(var n=0;n<cnt;n++) src()
  var end=new Date()
  if(!mute) console.log(name,src(),(end-start)*1000/cnt,"us")
}

function runTests(n,tests) {
  clog("benchmark -----------------")
  const run=runn(n)
  const heat=runn(n/100)
  for(var r=0;r<100;r++)
    for(var n of tests)
      heat(n.fst(),n.snd(),true)
  for(var n of tests)
    run(n.fst(),n.snd())
}

exports.runTests=runTests

