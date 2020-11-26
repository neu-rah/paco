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
  isChar,inRange,
  isDigit,isLowerCase,isUpperCase,isLetter,isAlphaNum,
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
const range=(a,z)=>c=>satisfy(inRange(a,z))(c)
const digit=satisfy(isDigit)
const lowerCase=satisfy(isLowerCase)
const upperCase=satisfy(isUpperCase)
const letter=satisfy(isLetter)
const alphaNum=satisfy(isAlphaNum)

const many=p=>parserOf(io=>p.then(many(p))(io).or(Right(io)))
const many1=p=>parserOf(p.then(many(p)))

const parse=p=>str=>{
  const r=p(Pair(str,[]))
  return r.then(r.map(snd))}

// testing --------------------------------------------------------------

//using the parser continuation syntax
// `.then` `.skip` `.or`
// console.log(
//   digit
//     .skip(digit)
//     .then(digit)//chain or parsers
//     .as(mconcat)//same a .join()
//     (Pair("123",[]))//initial state
//     // .map(map(o=>[o.join("")]))//format output
// )

// console.log(
//   skip(digit)
//     .then(digit)
//     .then(digit)
//     .join("|")
//     (Pair("123",[]))
//     // .map(map(o=>[o.join("")]))
// )

// clog(many(letter.or(digit)).join()(Pair("0x12Some test",[])))

// clog(digit.then(digit.then(digit).join().as(o=>o*10))(Pair("123",[])))

// clog(many(digit).join()(Pair("123x",[])))

// var io=Pair("123",[])

exports.boot=boot
exports.skip=skip
exports.satisfy=satisfy
exports.char=char
exports.range=range
exports.digit=digit
exports.lowerCase=lowerCase
exports.upperCase=upperCase
exports.letter=letter
exports.alphaNum=alphaNum
exports.many=many
exports.many1=many1
exports.parse=parse
