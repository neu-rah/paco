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
  o.then=p=>parserOf(o.expect+"\nthen "+p.expect)(io=>io.mbind(o).mbind(p))
  o.skip=p=>parserOf(o.expect+"\nskip "+p.expect)(io=>{
    const os=io.mbind(o)
    return os.mbind(p).map(map(o=>snd(fromRight(os)))).when(os)
  })
  o.failsWith=msg=>parserOf(msg)(io=>o(io).or(Left(Pair(io.fst(),msg))))
  o.or=p=>parserOf(o.expect+" or "+p.expect)//using alternative <|>
    (io=>{
      const r=o(io)
      if(isRight(r)) return r;
      return r.or(p(io)).or(Left(Pair(io.fst(),o.or(p).expect)))
    })
  const xfname=f=>{
    const ff=f.name||f.toString()
    return ff.length<15?ff:ff.substr(0,12)+"..."
  }
  o.as=f=>parserOf("("+o.expect+")->as("+xfname(f)+")")(io=>Pair(io.fst(),[]).mbind(o).map(map(f)).map(map(x=>io.snd().append(x))))
  o.join=p=>parserOf
    (typeof p==="undefined"?"("+o.expect+")->join()":"("+o.expect+")->join(\""+p+"\")")
    (io=>typeof p==="undefined"?o.as(mconcat)(io):o.as(o=>o.join(p))(io))
  o.expect=e
  return (self=>o)(o)
}

// Combinators --------------
//and id parse combinator to apply continuations on root elements
const boot=()=>parserOf("")(fcomp(Right)(id))

const skip=o=>parserOf("skip "+o.expect)(io=>boot().skip(o)(io))//apply skip (continuation) to the root element, using `boot` combinator

const satisfy=chk=>parserOf(chk.expect||"to satisfy condition")(io=>{
  // clog("satisfy",chk.expect)
  return chk(head(io.fst()))?
    Right(//success...
      Pair(//build a pair of remaining input and composed output
        tail(io.fst()),//consume input
        io.snd().append([head(io.fst())])))//compose the outputs
    :Left( Pair(io.fst(),chk.expect||satisfy(chk).expect))
})

//this one use the javascript `startsWith` function...
//this parser will never consume on fail
// const string=str=>parserOf("string `"+str+"`")(
//   function(io){
//     // clog(io,this)
//     if(io.fst().startsWith(str))
//       return Right(Pair(io.fst().substr(str.length),io.snd().append(str)))
//     return Left(io.map(_=>str))
//   }
// )
//use this one for a character at a time parsing, 
//here error report will be at character match
const string=str=>parserOf("string `"+str+"`")
  (foldl1(a=>b=>a.then(b))(str.split("").map(o=>char(o))).join())

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

const optional=p=>parserOf("optional "+p.expect)(io=>p(io).or(Right(io)))
const choice=ps=>foldl1(a=>b=>a.or(b))(ps)
const many=p=>parserOf("many("+p.expect+")")(io=>p.then(many(p))(io).or(Right(io)))
const many1=p=>parserOf("at least one "+p.expect)(p.then(many(p)))
const count=n=>p=>parserOf(n+" of "+p.expect)
  (io=>io.snd().length<n?p.then(count(n)(p))(io):Right(io))
const between=open=>p=>close=>skip(open).then(p).skip(close)
const option=x=>p=>parserOf("option "+p.expect)(io=>p(io).or(Right(Pair(io.fst(),x))))
const optionMaybe=p=>parserOf("maybe "+p.expect)(io=>p.as(Just)(io).or(Right(Pair(io.fst(),Nothing()))))
const sepBy=p=>sep=>parserOf(p.expect+" separated by "+sep.expect)
  (io=>p.then(many(skip(sep).then(p)))(io).or(Right(Pair(io.fst(),[]))))
const sepBy1=p=>sep=>parserOf(p.expect+" separated by "+sep.expect)
(io=>p.then(many(skip(sep).then(p)))(io))
const endBy=p=>sep=>end=>sepBy(p)(sep).then(skip(end))
const endBy1=p=>sep=>end=>sepBy1(p)(sep).then(skip(end))

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
      +"` here->"+fromLeft(r).fst().substr(0,10)+"..."
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
exports.count=count
exports.between=between
exports.option=option
exports.optionMaybe=optionMaybe
exports.sepBy=sepBy
exports.endBy=endBy
exports.endBy1=endBy1
exports.parse=parse