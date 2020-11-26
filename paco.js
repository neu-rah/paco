"use strict";

const {log,clog,xlog,debuging}=require("./src/debug")

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

//////////////////////////////////////////////////////////
// Parser

const {
  isChar,isOneOf,isNoneOf,inRange,
  isDigit,isLower,isUpper,isLetter,isAlphaNum,isHexDigit,isOctDigit,
  isSpace,isTab,is_nl,is_cr,isBlank,isEof
}=require("./src/primitives")

//recursively extends the parser continuations (.then, .skip, .or, ...)
const parserOf=o=>(
  o.then=p=>parserOf(io=>io.mbind(o).mbind(p))//o.then(p) <=> \io-> io >>= o >>= p
  ,o.skip=p=>parserOf(io=>{
    const os=io.mbind(o)
    return os.mbind(p).map(map(o=>snd(fromRight(os)))).when(os)
  })
  ,o.or=p=>parserOf(io=>o(io).or(p(io)))//using alternative <|>
  ,o.as=f=>parserOf(io=>Pair(io.fst(),[]).mbind(o).map(map(f)).map(map(x=>io.snd().append(x))))
  ,o.join=p=>typeof p=="undefined"?o.as(mconcat):o.as(o=>o.join(p))
  ,o)

// Combinators --------------
//and id parse combinator to apply continuations on root elements
const boot=()=>parserOf(fcomp(Right)(id))

const skip=o=>boot().skip(o)//apply skip (continuation) to the root element, using `boot` combinator
 
const satisfy=chk=>parserOf(io=>
  chk(head(io.fst()))?
    Right(//success...
      Pair(//build a pair of remaining input and composed output
        tail(io.fst()),//consume input
        io.snd().append([head(io.fst())])))//compose the outputs
    :Left(chk.expect))

const char=c=>satisfy(isChar(c))
const oneOf=cs=>satisfy(isOneOf(cs))
const noneOf=cs=>satisfy(isNoneOf(cs))
const range=(a,z)=>c=>satisfy(inRange(a,z))(c)
const digit=satisfy(isDigit)
const lower=satisfy(isLower)
const upper=satisfy(isUpper)
const letter=satisfy(isLetter)
const alphaNum=satisfy(isAlphaNum)
const hexDigit=satisfy(isHexDigit)
const octDigit=satisfy(isOctDigit)
const space=satisfy(isSpace)
const tab=satisfy(isTab)
const nl=satisfy(is_nl)
const cr=satisfy(is_cr)
const blank=satisfy(isBlank)
const eof=satisfy(isEof)

const many=p=>parserOf(io=>p.then(many(p))(io).or(Right(io)))
const many1=p=>parserOf(p.then(many(p)))

const spaces=many(space)
const blanks=many(blank)
const spaces1=many1(space)
const blanks1=many1(blank)

const parse=p=>str=>{
  const r=p(Pair(str,[]))
  return r.then(r.map(snd))}

exports.satisfy=satisfy
exports.char=char
exports.oneOf=oneOf
exports.noneOf=noneOf
exports.range=range
exports.digit=digit
exports.lower=lower
exports.upper=upper
exports.letter=letter
exports.alphaNum=alphaNum
exports.hexDigit=hexDigit
exports.octDigit=octDigit
exports.space=space
exports.tab=tab
exports.nl=nl
exports.cr=cr
exports.blank=blank
exports.spaces=spaces
exports.blanks=blanks
exports.spaces1=spaces1
exports.blanks1=blanks1
exports.eof=eof

exports.boot=boot
exports.skip=skip
exports.many=many
exports.many1=many1
exports.parse=parse
