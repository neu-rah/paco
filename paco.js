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

const prim=require("./src/primitives")

//recursively extends the parser continuations (.then, .skip, .or, ...)
const parserOf=e=>o=>{
  o.parse=s=>o(Pair(s,[]))
  o.then=p=>parserOf(o.expect+" then "+p.expect)(io=>io.mbind(o).mbind(p))
  o.skip=p=>parserOf(o.expect+" skip "+p.expect)(io=>{
    const os=io.mbind(o)
    return os.mbind(p).map(map(o=>snd(fromRight(os)))).when(os)
  })
  o.failsWith=msg=>parserOf(msg)(io=>o(io).or(Left(Pair(io.fst(),msg))))
  o.or=p=>parserOf(o.expect+" or "+p.expect)(io=>o(io).or(p(io)).or(Left(Pair(io.fst(),o.or(p).expect))))//using alternative <|>
  o.as=f=>parserOf(o.expect+" transform")(io=>Pair(io.fst(),[]).mbind(o).map(map(f)).map(map(x=>io.snd().append(x))))
  o.join=p=>typeof p=="undefined"?o.as(mconcat):o.as(o=>o.join(p))
  o.expect=e
  return (self=>o)(o)
}

// Combinators --------------
//and id parse combinator to apply continuations on root elements
const boot=()=>parserOf("")(fcomp(Right)(id))

const skip=o=>boot().skip(o)//apply skip (continuation) to the root element, using `boot` combinator

const satisfy=chk=>parserOf(chk.expect||"to satisfy condition")(io=>
  chk(head(io.fst()))?
    Right(//success...
      Pair(//build a pair of remaining input and composed output
        tail(io.fst()),//consume input
        io.snd().append([head(io.fst())])))//compose the outputs
    :Left( Pair(io.fst(),chk.expect||satisfy(chk).expect))
)

const string=str=>parserOf("string `"+str+"`")(
  function(io){
    // clog(io,this)
    if(io.fst().startsWith(str))
      return Right(Pair(io.fst().substr(str.length),io.snd().append(str)))
    return Left(io.map(_=>str))
  }
)

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

const optional=p=>parserOf("optional ",p.expect)(io=>p(io).or(Right(io)))
const choice=ps=>foldr1(a=>b=>a.or(b))(ps)

const many=p=>parserOf("many ",p.expect)(io=>p.then(many(p))(io).or(Right(io)))
const many1=p=>parserOf("at least one "+p.expect)(p.then(many(p)))

const spaces=many(space)
const blanks=many(blank)
const spaces1=many1(space)
const blanks1=many1(blank)
const digits=many(digit)

const parse=p=>str=>{
  const r=p(Pair(str,[]))
  return isRight(r)?
    r.map(snd):
    Left(
      "error, expecting "+fromLeft(r).snd()
      +" but found `"+head(fromLeft(r).fst())
      +"` here->"+fromLeft(r).fst().substr(0,10)
    )
}

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
exports.digits=digits
exports.eof=eof
exports.string=string

exports.boot=boot
exports.skip=skip
exports.many=many
exports.many1=many1
exports.optional=optional
exports.choice=choice
exports.parse=parse