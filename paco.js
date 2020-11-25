"use strict";

const {log,clog,xlog,debuging}=require("./src/debug")

const {
  //patch primitive data types
  patchPrimitives,
  //Functional
  id,fcomp,fchain,constant,flip,cons,
  //Monoid
  empty,append,mconcat,monoidFunction,monoidString,monoidArray,
  //List
  head,tail,listString,listArray,
  //Functor
  map,
  //Monad
  pure,mbind,
  //Pair (tupple)
  Pair,fst,snd,
  //Maybe
  Maybe,isMaybe,Nothing,isNothing,Just,isJust,fromJust,
  //Either
  isEither,Left,isLeft,fromLeft,Right,isRight,fromRight,
  //foldable
  foldable,foldr,foldl,foldr1,foldl1,foldMap,
} = require("funjs");

patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
)

//////////////////////////////////////////////////////////
// Parser

//parser primitves
const inRange=(a,z)=>o=>a<=o&&o<=z
const isDigit=inRange('0','9')
isDigit.expect="digit"
const isLowerCase=inRange('a','z')
const isUpperCase=inRange('A','Z')
const isLetter=o=>isLowerCase(o)||isUpperCase(o)
const isAlphaNum=o=>isLetter(o)||isDigit(o)

//recursively extends the parser continuations (.then, .drop, .or, ...)
const parserOf=o=>(
  o.then=p=>parserOf(io=>io.mbind(o).mbind(p))//o.then(p) <=> \io-> io >>= o >>= p
  ,o.drop=p=>parserOf(io=>{
    const os=io.mbind(o)
    return os.mbind(p).map(map(o=>snd(fromRight(os)))).when(os)
  })
  ,o.or=p=>parserOf(io=>o(io).or(p(io)))
  ,o)

//and id parse combinator to apply continuations on root elements
const boot=()=>parserOf(fcomp(Right)(id))

const drop=o=>boot().drop(o)//apply drop (continuation) to the root element, using `boot` combinator
 
const satisfy=chk=>parserOf(io=>
  chk(head(io.fst()))?
    Right(//success...
      Pair(//build a pair of remaining input and composed output
        tail(io.fst()),//consume input
        io.snd().append([head(io.fst())])))//compose the outputs
    :Left(chk.expect))

const digit=satisfy(isDigit)
const lowerCase=satisfy(isLowerCase)
const upperCase=satisfy(isUpperCase)
const letter=satisfy(isLetter)
const alphaNum=satisfy(isAlphaNum)

const parse=p=>str=>p(Pair(str,[]))

console.log(
  Pair("123",[])
    .mbind(digit)
    .mbind(digit)
    .mbind(digit)
    .map(map(o=>[o.join("")]))
)

console.log(
  digit
    .drop(digit)
    .then(digit)
    (Pair("123",[]))
    .map(map(o=>[o.join("")]))
)

console.log(
  drop(digit)
    .then(digit)
    .then(digit)
    (Pair("123",[]))
    .map(map(o=>[o.join("")]))
)

clog(letter.or(digit)(Pair("0a12",[])))

var io=Pair("123",[])