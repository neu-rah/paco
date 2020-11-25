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
  ,o.or=p=>parserOf(io=>o(io).or(p(io)))//using alternative <|>
  ,o.as=f=>parserOf(io=>Pair(io.fst(),[]).mbind(o).map(map(f)).map(map(x=>io.snd().append(x))))
  ,o.join=p=>typeof p=="undefined"?o.as(mconcat):o.as(o=>o.join(p))
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

const many=p=>parserOf(io=>p.then(many(p))(io).or(Right(io)))
const many1=p=>parserOf(p.then(many(p)))

const parse=p=>str=>p(Pair(str,[]))

// testing --------------------------------------------------------------

//using the parser continuation syntax
// `.then` `.drop` `.or`
// console.log(
//   digit
//     .drop(digit)
//     .then(digit)//chain or parsers
//     .as(mconcat)//same a .join()
//     (Pair("123",[]))//initial state
//     // .map(map(o=>[o.join("")]))//format output
// )

// console.log(
//   drop(digit)
//     .then(digit)
//     .then(digit)
//     .join("|")
//     (Pair("123",[]))
//     // .map(map(o=>[o.join("")]))
// )

// clog(letter.or(digit)(Pair("0a12",[])))

// clog(digit.then(digit.then(digit).as(o=>o.join("")*10))(Pair("123",[])))

clog(many(digit).join()(Pair("123x",[])))

var io=Pair("123",[])