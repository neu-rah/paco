"use strict";

const assert = require("assert");

const {
  patchPrimitives,//patch primitive data types
  id,fcomp,fchain,constant,flip,cons,//Functional
  empty,append,mconcat,//Monoid
  head,tail,//List
  map,//Functor
  pure,mbind,//Monad
  Pair,fst,snd,//Pair (tupple)
  Maybe,isMaybe,Nothing,isNothing,Just,isJust,fromJust,//Maybe
  isEither,Left,isLeft,fromLeft,Right,isRight,fromRight,//Either
  foldable,foldr,foldl,foldr1,foldl1,foldMap,//foldable
} = require("funjs");

patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
)

const {
  char,oneOf,noneOf,range,many,many1,parse,
  satisfy,boot,skip,
  digit,lower,upper,letter,alphaNum,hexDigit,octDigit,
  space,tab,nl,cr,blank,eof,string
}=require("../paco.js")

///////////////////////////////////////////
// test stuff
describe("Parser",function() {
  it("parser boot and utilities",async ()=>{
    assert.deepStrictEqual(boot()(Pair("",[])),Right(Pair("",[])),"parser boot, always succeeds, no consume initial parser state")
    assert.deepStrictEqual(parse(boot())(""),Right([]),"`parse` function")
    assert.deepStrictEqual(parse(char('x'))("x"),Right(["x"]),"char('x')")
    assert(isLeft(parse(char('x'))("")),"eof fail")
  })
})
describe("String parser",function() {
  it("satisfy",async ()=>{
    assert.deepStrictEqual(parse(satisfy(_=>true))("."),Right(["."]),"satisfy")
    assert(isLeft(parse(satisfy(_=>false))("a")),"satisfy fail")
  })
  it("char",async ()=>{
    assert.deepStrictEqual(parse(char('x'))("x"),Right(["x"]),"char")
    assert(isLeft(parse(char('x'))("a")),"char fail")
  })
  it("range",async ()=>{
    assert.deepStrictEqual(parse(range('a','f'))("e"),Right(["e"]),"range")
    assert(isLeft(parse(range('a','f'))("y")),"range fail")
  })
  it("digit",async ()=>{
    assert.deepStrictEqual(parse(digit)("1"),Right(["1"]),"digit")
    assert(isLeft(parse(digit)("a")),"digit fail")
  })
  it("lower",async ()=>{
    assert.deepStrictEqual(parse(lower)("a"),Right(["a"]),"lower")
    assert(isLeft(parse(lower)("A")),"lower fail")
  })
  it("upper",async ()=>{
    assert.deepStrictEqual(parse(upper)("Z"),Right(["Z"]),"upper")
    assert(isLeft(parse(upper)("z")),"upper fail")
  })
  it("letter",async ()=>{
    assert.deepStrictEqual(parse(letter)("x"),Right(["x"]),"letter")
    assert(isLeft(parse(letter)("#")),"letter fail")
  })
  it("alphaNum",async ()=>{
    assert.deepStrictEqual(parse(alphaNum)("1"),Right(["1"]),"alphaNum")
    assert.deepStrictEqual(parse(alphaNum)("N"),Right(["N"]),"alphaNum")
    assert(isLeft(parse(alphaNum)("#")),"alphaNum fail")
  })
})
describe("string",function() {
  it("string",async ()=>{
    assert.deepStrictEqual(parse(string("ok"))("oks"),Right(["ok"]))
    assert(isLeft(parse(string("ok"))("onks")))
  })
})
describe("bindings",function() {
  it(".then sequence",async ()=>{
    const p="letter.then(digit).then(digit)"
    const c=parse(eval(p))
    assert.deepStrictEqual(c("a12"),Right(["a","1","2"]),p+"")
    assert(isLeft(c("a1")),p+" fail")
    assert(isLeft(c("1")),p+" fail")
  })
  it(".skip boot",async ()=>{
    const c=parse(skip(letter).then(digit))
    assert.deepStrictEqual(c("a1"),Right(["1"]))
    assert(isLeft(c("a")))
    assert(isLeft(c("1")))
  })
  it(".skip sequence",async ()=>{
    const c=parse(letter.skip(digit).then(digit))
    assert.deepStrictEqual(c("a12"),Right(["a","2"]))
    assert(isLeft(c("aa")))
    assert(isLeft(c("a1a")))
    assert(isLeft(c("1")))
  })
  it(".or alternative",async ()=>{
    const c=parse(letter.or(digit).then(digit))
    assert.deepStrictEqual(c("a1"),Right(["a","1"]))
    assert.deepStrictEqual(c("01"),Right(["0","1"]))
    assert(isLeft(c("#a")))
    assert(isLeft(c("a#")))
    assert(isLeft(c("1")))
  })
  it("output transformation",async ()=>{
    assert.deepStrictEqual(
      parse(letter.then(digit.then(digit).join()))("a12"),
      Right(["a","12"]),"group and join subset")
    assert.deepStrictEqual(
      parse(letter.then(digit.then(digit).join().as(o=>o*1)))("a12"),
      Right(["a",12]),"group, join and transform subset")
  })
})
describe("Metaparsers",function() {
  it("many",async ()=>{
    assert.deepStrictEqual(
      parse(many(digit).join())("123"),
      Right(["123"]),"repeat a parser"
    )
    assert.deepStrictEqual(
      parse(many(digit).join())(""),
      Right([undefined]),"repeat a parser option"
    )
    assert.deepStrictEqual(
      parse(many1(digit).join())("123"),
      Right(["123"]),"repeat a parser once or more"
    )
    assert(
      isLeft(parse(many1(digit).join())("a")),"repeat a parser once or more fail"
    )
  })
})
  