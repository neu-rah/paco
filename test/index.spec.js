"use strict";

const assert = require("assert");

const {
  prev,next,
  isNone,isAnyChar,isChar,isOneOf,isNoneOf,inRange,notInRange,isLess,isGreater,
  isDigit,isLower,isUpper,isLetter,isAlphaNum,isHexDigit,isOctDigit,
  isSpace,isTab,is_nl,is_cr,isBlank,isEof,isNotEof,
  None,Any,Point,Range,NotRange,Ranges,Less,Greater,Set,Unset,Eof,NotEof
}=require("../src/primitives")

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
  anyChar,char,oneOf,noneOf,range,satisfy,skip,
  digit,lower,upper,letter,alphaNum,hexDigit,octDigit,
  space,tab,nl,cr,blank,
  digits,spaces,blanks,spaces1,blanks1,eof,
  string,regex,many,many1,optional,
  choice,count,between,option,optionMaybe,sepBy,endBy,endBy1,
  parse,none,
}=require("../paco.js")

///////////////////////////////////////////
// test stuff
describe("Parser",function() {
  it("parser `none` and utilities",async ()=>{
    assert.deepStrictEqual(none(Pair("",[])),Right(Pair("",[])),"parser boot, always succeeds, no consume initial parser state")
    assert.deepStrictEqual(parse(">")(none())(""),Right([]),"`parse` function")
    assert.deepStrictEqual(parse(">")(char('x'))("x"),Right(["x"]),"char('x')")
    assert(isLeft(parse(">")(char('x'))("")),"eof fail")
  })
})
describe("Primitives",function() {
  it("domain Any",async ()=>{
    assert(isAnyChar.exclude(isEof).domain.constructor===Any,"exclude eof")
    assert(isAnyChar.exclude(isNotEof).domain.constructor===Any,"exclude not eof")
    assert(isAnyChar.exclude(isNone).domain.constructor===Any,"exclude none")
    assert(isAnyChar.exclude(isAnyChar).domain.constructor===None,"exclude none")
    assert.deepStrictEqual(isAnyChar.exclude(isChar('a')).domain,isNoneOf('a').domain,"exclude char")
    assert.deepStrictEqual(isAnyChar.exclude(inRange('a','z')).domain,notInRange('a','z').domain,"exclude range")
    assert.deepStrictEqual(isAnyChar.exclude(notInRange('a','z')).domain,inRange('a','z').domain,"exclude not in range")
    assert.deepStrictEqual(isAnyChar.exclude(isGreater('o')).domain,isLess(prev('o')).domain,"exclude greater")
    assert.deepStrictEqual(isAnyChar.exclude(isLess('o')).domain,isGreater(next('o')).domain,"exclude less")
    assert.deepStrictEqual(isAnyChar.exclude(isOneOf('o')).domain,isNone.domain,"exclude oneOf")
  })
})

describe("Character parsers",function() {
  it("satisfy",async ()=>{
    assert.deepStrictEqual(parse(">")(satisfy(_=>true))("."),Right(["."]),"satisfy")
    assert(isLeft(parse(">")(satisfy(_=>false))("a")),"satisfy fail")
  })
  it("char",async ()=>{
    assert.deepStrictEqual(parse(">")(char('x'))("x"),Right(["x"]),"char")
    assert(isLeft(parse(">")(char('x'))("a")),"char fail")
  })
  it("range",async ()=>{
    assert.deepStrictEqual(parse(">")(range('a','f'))("e"),Right(["e"]),"range")
    assert(isLeft(parse(">")(range('a','f'))("y")),"range fail")
  })
  it("digit",async ()=>{
    assert.deepStrictEqual(parse(">")(digit)("1"),Right(["1"]),"digit")
    assert(isLeft(parse(">")(digit)("a")),"digit fail")
  })
  it("lower",async ()=>{
    assert.deepStrictEqual(parse(">")(lower)("a"),Right(["a"]),"lower")
    assert(isLeft(parse(">")(lower)("A")),"lower fail")
  })
  it("upper",async ()=>{
    assert.deepStrictEqual(parse(">")(upper)("Z"),Right(["Z"]),"upper")
    assert(isLeft(parse(">")(upper)("z")),"upper fail")
  })
  it("letter",async ()=>{
    assert.deepStrictEqual(parse(">")(letter)("x"),Right(["x"]),"letter")
    assert(isLeft(parse(">")(letter)("#")),"letter fail")
  })
  it("alphaNum",async ()=>{
    assert.deepStrictEqual(parse(">")(alphaNum)("1"),Right(["1"]),"alphaNum")
    assert.deepStrictEqual(parse(">")(alphaNum)("N"),Right(["N"]),"alphaNum")
    assert(isLeft(parse(">")(alphaNum)("#")),"alphaNum fail")
  })
  it("oneOf",async ()=>{
    assert.deepStrictEqual(parse(">")(oneOf("01"))("0"),Right(["0"]),"alphaNum")
    assert.deepStrictEqual(parse(">")(oneOf("01"))("1"),Right(["1"]),"alphaNum")
    assert(isLeft(parse(">")(oneOf("01"))("#")),"oneOf fail")
  })
  it("noneOf",async ()=>{
    assert.deepStrictEqual(parse(">")(noneOf("01"))("x"),Right(["x"]),"alphaNum")
    assert(isLeft(parse(">")(noneOf("01"))("1")),"oneOf fail")
  })
})
describe("String parsers",function() {
  it("string",async ()=>{
    assert.deepStrictEqual(parse(">")(string("ok"))("oks"),Right(["ok"]))
    assert(isLeft(parse(">")(string("ok"))("onks")))
  })
  it("regex match",async ()=>{
    assert.deepStrictEqual(parse(">")(regex("#([a-zA-Z]+)[ -]([0-9]+)"))("#an-123..."),Right(["an","123"]))
    assert(isLeft(parse(">")(regex("[0-9]"))("o")))
  })
})
describe("bindings",function() {
  it(".then sequence",async ()=>{
    const p="letter.then(digit).then(digit)"
    const c=parse(">")(eval(p))
    assert.deepStrictEqual(c("a12"),Right(["a","1","2"]),p+"")
    assert(isLeft(c("a1")),p+" fail")
    assert(isLeft(c("1")),p+" fail")
  })
  it(".skip boot",async ()=>{
    const c=parse(">")(skip(letter).then(digit))
    assert.deepStrictEqual(c("a1"),Right(["1"]))
    assert(isLeft(c("a")))
    assert(isLeft(c("1")))
  })
  it(".skip sequence",async ()=>{
    const c=parse(">")(letter.skip(digit).then(digit))
    assert.deepStrictEqual(c("a12"),Right(["a","2"]))
    assert(isLeft(c("aa")))
    assert(isLeft(c("a1a")))
    assert(isLeft(c("1")))
  })
  it(".or alternative",async ()=>{
    const c=parse(">")(letter.or(digit).then(digit))
    assert.deepStrictEqual(c("a1"),Right(["a","1"]))
    assert.deepStrictEqual(c("01"),Right(["0","1"]))
    assert(isLeft(c("#a")))
    assert(isLeft(c("a#")))
    assert(isLeft(c("1")))
  })
  it("output transformation",async ()=>{
    assert.deepStrictEqual(
      parse(">")(letter.then(digit.then(digit).join()))("a12"),
      Right(["a","12"]),"group and join subset")
    assert.deepStrictEqual(
      parse(">")(letter.then(digit.then(digit).join().as(parseInt)))("a12"),
      Right(["a",12]),"group, join and transform subset")
  })
})
describe("Metaparsers",function() {
  it("many",async ()=>{
    assert.deepStrictEqual(
      parse(">")(many(digit).join())("123"),
      Right(["123"]),"repeat a parser"
    )
    assert.deepStrictEqual(
      parse(">")(many(digit).join())(""),
      Right([]),"repeat a parser option"
    )
  })
  it("many1",async ()=>{
      assert.deepStrictEqual(
      parse(">")(many1(digit).join())("123"),
      Right(["123"]),"repeat a parser once or more"
    )
    assert(
      isLeft(parse(">")(many1(digit).join())("a")),"repeat a parser once or more fail"
    )
  })
  it("optional",async ()=>{
    assert.deepStrictEqual(
      parse(">")(optional(digits).then(letter).join())("123a"),
      Right(["123a"]),"optional composition found"
    )
    assert.deepStrictEqual(
      parse(">")(optional(digits).then(letter).join())("a..."),
      Right(["a"]),"optional composition missing"
    )
    assert(
      isLeft(parse(">")(optional(digits).then(letter).join())("#1a")),"optional composition fail"
    )
  })
  it("choice",async ()=>{
    const parsing=parse(">")(choice([digit,letter]))
    assert.deepStrictEqual(
      parsing("1"),
      Right(["1"]),"choice found"
    )
    assert.deepStrictEqual(
      parsing("a"),
      Right(["a"]),"choice found"
    )
    assert(
      isLeft(parsing("#")),"choice fail"
    )
  })
  it("count",async ()=>{
    const parsing=parse(">")(count(2)(digit).join())
    assert.deepStrictEqual(
      parsing("123"),
      Right(["12"]),"count found"
    )
    assert(
      isLeft(parsing("1a")),"count fail"
    )
    assert(
      isLeft(parsing("1")),"count fail"
    )
    assert(
      isLeft(parsing("")),"count fail"
    )
  })
  it("between",async ()=>{
    const parsing=parse(">")(between(space)(many1(noneOf(" ")))(space).join())
    assert.deepStrictEqual(
      parsing(" ab.12 "),
      Right(["ab.12"]),"between match"
    )
    assert(
      isLeft(parsing("#")),"between fail"
    )
  })
  it("option",async ()=>{
    const parsing=parse(">")(option(["0"])(digit))
    assert.deepStrictEqual(
      parsing("1"),
      Right(["1"]),"option match"
    )
    assert.deepStrictEqual(
      parsing("#"),
      Right(["0"]),"option use default"
    )
  })
})
  