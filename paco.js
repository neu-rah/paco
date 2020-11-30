"use strict";

const {log,clog,xlog,debuging}=require("./src/debug")
const {Msg,Expect,Error}=require("./src/error")
const {StringStream}=require("./src/strstr.js")

const {
  patchPrimitives,//patch primitive data types
  curry,//js curry style
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
  isAnyChar,isChar,isOneOf,isNoneOf,inRange,
  isDigit,isLower,isUpper,isLetter,isAlphaNum,isHexDigit,isOctDigit,
  isSpace,isTab,is_nl,is_cr,isBlank,isEof
}=require("./src/primitives")

const prim=require("./src/primitives")

//recursively extends the parser continuations (.then, .skip, .or, ...)
const parserOf=curry((e,o)=>{
  o.parse=s=>o(Pair(s,[]))
  o.post=f=>parserOf
    (o.expect+" verify of "+f)
    (io=>f(o(io)))
  o.chk=curry((m,f)=>parserOf(o.expect+" check of "+f)
    (io=>{
      const r=o.onFailMsg(m)(io)
      if(isLeft(r)||f(fromRight(r).snd())) return r
      return Left(Pair(io.fst(),new Error(m)))
    }))
  o.then=p=>parserOf(o.expect+"\nthen "+p.expect)(io=>io.mbind(o).mbind(p))
  o.skip=p=>parserOf(o.expect+"\nskip "+p.expect)(io=>{
    const os=io.mbind(o)
    return os.mbind(p).map(map(o=>snd(fromRight(os)))).when(os)
  })
  o.notFollowedBy=p=>parserOf
    (o.expect+" bot followed by "+p.expect)
    (io=>{
      const os=o(io)
      const ps=os.mbind(p)
      return isLeft(ps)?os:Left(Pair(io.fst(),new Expect(o.notFollowedBy(p).expect)))
    })
  o.onFailMsg=msg=>parserOf(msg)(io=>o(io).or(Left(Pair(io.fst(),new Error(msg)))))
  o.or=p=>parserOf(o.expect+" or "+p.expect)//using alternative <|>
    (io=>{
      const r=o(io)
      if(isRight(r)) return r;
      return r.or(p(io)).or(Left(Pair(io.fst(),new Expect(o.or(p).expect))))
    })
  const xfname=f=>{
    const ff=f.name||f.toString()
    return ff.length<15?ff:ff.substr(0,12)+"..."
  }
  o.as=f=>parserOf
    ("("+o.expect+")->as("+xfname(f)+")")
    (io=>Pair(io.fst(),[]).mbind(o).map(map(f)).map(map(x=>io.snd().append(x))))
  o.join=p=>parserOf
    (typeof p==="undefined"?"("+o.expect+")->join()":"("+o.expect+")->join(\""+p+"\")")
    (io=>typeof p==="undefined"?o.as(mconcat)(io):o.as(o=>o.join(p))(io))
  o.expect=e
  return (self=>o)(o)
})

// Combinators --------------
//an "id" combinator to apply continuations on root elements
// const boot=()=>parserOf("")(fcomp(Right)(id))
// deprecated use `none` parser

//parser always succeedes without consuming
const none=parserOf("none")(fcomp(Right)(id))

//apply skip (continuation) to the root element, using `none` combinator
const skip=o=>parserOf("skip "+o.expect)(io=>none.skip(o)(io))

//check a character with a boolean function
const satisfy=chk=>parserOf(chk.expect||"to satisfy condition")(io=>{
  // clog("satisfy",chk.expect)
  return chk(head(io.fst()))?
    Right(//success...
      Pair(//build a pair of remaining input and composed output
        tail(io.fst()),//consume input
        io.snd().append([head(io.fst())])))//compose the outputs
    :Left( Pair(io.fst(),new Expect(chk.expect||satisfy(chk).expect)))//or report error
})

//match a string
const string=str=>parserOf("string `"+str+"`")
  (foldl1(a=>b=>a.then(b))(str.split("").map(o=>char(o))).join())

//regex match
const regex=e=>parserOf("regex /"+e+"/")
(io=>{
  const r=io.fst().match(e)
  return r===null?
    Left(Pair(io.fst(),new Expect(regex(e).expect))):
    Right(Pair(r.input.substr(r[0].length),r.slice(1,r.length)))
})

//character parsers
const anyChar=satisfy(isAnyChar)
const char=c=>satisfy(isChar(c))
const oneOf=cs=>satisfy(isOneOf(cs))
const noneOf=cs=>satisfy(isNoneOf(cs))
const range=curry((a,z)=>parserOf(inRange(a,z).expect)(c=>satisfy(inRange(a,z))(c)))
const digit=satisfy(isDigit)
const lower=satisfy(isLower)
const upper=satisfy(isUpper)
const letter=satisfy(isLetter)
const alphaNum=satisfy(isAlphaNum)
const hexDigit=satisfy(isHexDigit)
const octDigit=satisfy(isOctDigit)
const space=satisfy(isSpace);space.expect="space"
const tab=satisfy(isTab);tab.expect="tab"
const nl=satisfy(is_nl);nl.expect="new-line"
const cr=satisfy(is_cr);cr.expect="carryage return"
const blank=satisfy(isBlank)
const eof=satisfy(isEof)

//meta-parsers
const optional=p=>parserOf("optional "+p.expect)(io=>p(io).or(Right(io)))
const choice=ps=>foldl1(a=>b=>a.or(b))(ps)
const many=p=>parserOf("many("+p.expect+")")(io=>p.then(many(p))(io).or(Right(io)))
const many1=p=>parserOf("at least one "+p.expect)(p.then(many(p)))
const manyTill=curry((p,e)=>parserOf
  ("many "+p.expect+" until "+e.expect)
  (io=>skip(e).or(p.then(manyTill(p,e)))(io)))
const count=curry((n,p)=>parserOf(n+" of "+p.expect)
  (io=>io.snd().length<n?p.then(count(n)(p))(io):Right(io)))
const between=curry((open,p,close)=>skip(open).then(p).skip(close))
const option=curry(
  (x,p)=>parserOf("option "+p.expect)
  (io=>p(io).or(Right(Pair(io.fst(),x)))))
const optionMaybe=p=>parserOf("maybe "+p.expect)(io=>p.as(Just)(io).or(Right(Pair(io.fst(),Nothing()))))
const sepBy=curry((p,sep)=>parserOf(p.expect+" separated by "+sep.expect)
  (io=>p.then(many(skip(sep).then(p)))(io)))//.or(Right(Pair(io.fst(),[]))))
const sepBy1=curry((p,sep)=>parserOf(p.expect+" separated by "+sep.expect)
  (io=>p.then(many(skip(sep).then(p)))(io)))
const endBy=curry((p,sep,end)=>sepBy(p)(sep).then(skip(end)))
const endBy1=curry((p,sep,end)=>sepBy1(p)(sep).then(skip(end)))

//high order character parser
const spaces=many(space);spaces.expect="spaces"//TODO: this expect adjoin is not working
const blanks=many(blank);blanks.expect="white space"
const spaces1=many1(space);spaces1.expect="at least one space"
const blanks1=many1(blank);blanks1.expect="some white space"
const digits=many(digit);digits.expect="digits"

//interpret a result and enventually build an error message
const res=curry((fn,r)=>{
  if(isRight(r)) return r.map(snd)
  else {
    const rr=fromLeft(r)
    var fpos=fn
    // clog("error obj:",r,"rr",rr)
    if(typeof rr.fst().line!=="undefined") {
      const pos=rr.fst().getPos()
      fpos+=":"+pos.join(":")+"\n"
    }
    const found=head(rr.fst())//the char to blame
    clog("found:",found)
    return rr.snd().isError()?
      Left(fpos+"error, "+rr.snd()):
      Left(
        fpos+"error, expecting "+rr.snd()
        +" but found `"+(found||"eof")+"`"
        +(found?" here->"+rr.fst().toString().substr(0,10)+"...":"")//TODO: this is expensive, refactor! (functional `take n`)
      )
  }
})

const parse=curry((fn,p,str)=>res(fn)(p(Pair(str,[]))))

exports.satisfy=satisfy
exports.anyChar=anyChar
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
exports.regex=regex

exports.none=none
exports.skip=skip
exports.many=many
exports.many1=many1
exports.manyTill=manyTill
exports.optional=optional
exports.choice=choice
exports.count=count
exports.between=between
exports.option=option
exports.optionMaybe=optionMaybe
exports.sepBy=sepBy
exports.sepBy1=sepBy1
exports.endBy=endBy
exports.endBy1=endBy1
exports.res=res
exports.parse=parse
exports.parserOf=parserOf