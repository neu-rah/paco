 "use strict";

 // we depend on:
 //rsite-funjs from https://github.com/neu-rah/funjs

const { log, clog, xlog,mxlog, debugging }=require("./src/debug")
const { Msg, Expect, Error }=require("./src/error")
const { SStr }=require("./src/strstr.js")

const {
  patchPrimitives,//patch primitive data types
  curry,//js curry style
  id, fcomp, fchain, constant, flip, cons,//Functional
  peano,succ,//Peano
  empty, append, mconcat,//Monoid
  head, tail, init, last, drop, take,//List
  map,//Functor
  pure, mbind,//Monad
  Pair, fst, snd,//Pair (tupple)
  Maybe, isMaybe, Nothing, isNothing, Just, isJust, fromJust,//Maybe
  isEither, Left, isLeft, fromLeft, Right, isRight, fromRight,//Either
  foldable, foldr, foldl, foldr1, foldl1, foldMap,//foldable
}=require("rsite-funjs");

patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
  Object().__proto__,
)

//////////////////////////////////////////////////////////
// Parser

const {
  isAnyChar, isChar, anyCase, isOneOf, isNoneOf, inRange,
  isDigit, isLower, isUpper, isLetter, isAlphaNum, isHexDigit, isOctDigit,
  isSpace, isTab, is_nl, is_cr, isBlank, isEof, isEol,
  Point, Set, Range,
}=require("./src/primitives")

var thenPrefix=undefined

const quickParam=p=>typeof p === "string" ? (p.length === 1 ? char(p) : string(p)) : p

const highOrder=o=>o.highOrder()
const canFail=o=>o.canFail()
var uniqueId=0

class Parser extends Function {
  constructor() {
    super('...args', 'return this.__self__.run(...args)')
    var self=this.bind(this)
    this.__self__=self
    if(debugging) self.uniqueId=uniqueId++
    return self
  }
  // _run(...args){return this.run(...args)}
  highOrder() {return false}
  canFail() {return false}
  consumes() {return true}
  safe() {return this.consumes()||this.canFail()}
  root() {return this}
  setEx(ex) {return this}
  parse(s) {return this(Pair(s, []))}
  post(f) {}

  //link something to this parser
  static Link=class Link extends Parser {
    constructor(o) {
      super()
      this.target=o
    }
    highOrder() {return this.target.highOrder()}
    canFail() {return this.target.canFail()}
    consumes() {return this.target.consumes()}
    root() {return this.target.root?this.target.root():this}
}
  //chain this parser to another
  static Chain=class Chain extends Parser.Link {
    constructor(o,p) {
      super(o)
      this.next=p
    }
    highOrder() {return this.target.highOrder()||this.next.highOrder()}
    canFail() {return this.target.canFail()||this.next.canFail()}
    consumes() {return this.target.consumes()||this.next.consumes()}
  }
  static Exclusive=class Exclusive extends Parser.Chain {
    constructor(o,p) {
      super(o,p)
    }
    setEx(ex) {return this}
  }

  static Post=class Post extends Parser.Link {
    constructor(o,f) {
      super(o)
      this.func=f
    }
    get expect() {return "["+this.target.expect+"]->Post process"}
    run(io) {return this.func(this.target(io))}
  }
  post(f) {return new Parser.Post(this,f)}

  static Verify=class Verify extends Parser.Link {
    constructor(o,f,m) {
      super(o)
      this.func=f
      this.msg=m
    }
    get expect() {return "["+this.target.expect+"]->verify!"}
    run(io) {
      const r=this.target(Pair(io.fst(),[]))
      if(isLeft(r)) return r
      if(this.func(fromRight(r).snd())) return r.map(map(x=>io.snd().append(x)))
      return Left(Pair(io.fst(),new Error(this.msg)))
    }
  }
  verify(f,m) {return new Parser.Verify(this,f,m)}

  static Then=class Then extends Parser.Exclusive {
    constructor(o,p,op) {
      super(o,p)
    }
    get expect() {return this.target.expect+"\nthen "+this.next.expect}
    get expect() {return this.target.expect+" then "+this.next.expect}
    safe() {return this.target.canFail()||this.next.consumes()}
    setEx(ex) {return thenPrefix?this.target.then(thenPrefix).then(this.next):this}
    run(io) {return io.mbind(this.target).mbind(this.next)}
  }
  then(p) {return new Parser.Then(this,quickParam(p))}

  static Skip=class Skip extends Parser.Exclusive {
    get expect() {return this.target.expect+"\nskip "+this.next.expect}
    run(io) {
      const os=io.mbind(this.target)
      return os.mbind(this.next).map(map(o=>snd(fromRight(os))))
    }
  }
  skip(p) {return new Parser.Skip(this,quickParam(p))}

  static LookAhead=class LookAhead extends Parser.Exclusive {
    get expect() {return this.target.expect+" but look ahead for "+this.next.expect}
    root() {return this.target.root().lookAhead(this.next.root())}
    consumes() {return this.target.consumes()}
    run(io) {
      const r=this.target(io)
      const ps=r.mbind(this.next)
      if (isLeft(ps)) return ps
      return r
    }
  }
  lookAhead(p) {return new Parser.LookAhead(this,quickParam(p))}

  static Excluding=class Excluding extends Parser.Exclusive {
    get expect() {return this.target.expect+" excluding "+this.next.expect}
    root() {return this.target.root().excluding(this.next.root())}
    canFail() {return this.target.canFail()||!this.next.canFail()}
    consumes() {return this.target.consumes()}
    run(io) {
      const ps=this.next(io)
      if (isRight(ps)) return Left(Pair(io.fst(), new Expect(this.expect)))
      return this.target(io)
    }
  }
  excluding(p) {return new Parser.Excluding(this,quickParam(p))}

  static NotFollowedBy=class NotFollowedBy extends Parser.Chain {
    get expect() {return this.target.expect+" excluding "+this.next.expect}
    root() {return this.target.root().notFollowedBy(this.next.root())}
    setEx(ex) {return new Parser.NotFollowedBy(this.target.setEx(ex),this.msg)}
    canFail() {return this.target.canFail()||!this.next.canFail()}
    consumes() {return this.target.consumes()}
    run(io) {
      const os=this.target(io)
      const ps=os.mbind(this.next)
      return isLeft(ps) ? os : Left(Pair(io.fst(), new Expect(this.expect)))
    }
  }
  notFollowedBy(p) {return new Parser.NotFollowedBy(this,quickParam(p))}

  static Or=class Or extends Parser.Chain {
    get expect() {return this.target.expect+" or "+this.next.expect}
    root() {return this.target.root().or(this.next.root())}
    setEx(ex) {return new Parser.Or(this.target.setEx(ex),this.next.setEx(ex))}
    consumes() {return this.target.consumes()||this.next.consumes()}
    run(io) {
      const r=this.target(io)
      if (isRight(r)) return r;//break `or` parameter expansion
      return r.or(this.next(io)).or(Left(Pair(io.fst(), new Expect(this.expect))))
    }
  }
  or(p) {return new Parser.Or(this,quickParam(p))}

  static  FailMsg=class FailMsg extends Parser.Link {
    constructor(o,msg) {
      super(o)
      this.msg=msg
    }
    get expect() {return this.msg}
    setEx(ex) {return new Parser.FailMsg(this.target.setEx(ex),this.msg)}
    run(io) {
      return this.target(io).or(Left(Pair(io.fst(), new Error(this.msg))))
    }
  }
  failMsg(msg) {return new Parser.FailMsg(this,msg)}

  static As=class As extends Parser.Link {
    constructor(o,f) {
      super(o)
      this.func=f
    }
    setEx(ex) {return new Parser.As(this.target.setEx(ex),this.func)}
    get expect() {
      const xfname=f=>{//aux
        const ff=f.name || f.toString()
        return ff.length < 15 ? ff : ff.substr(0, 12)+"..."
      }
      return "("+this.target.expect+")->as("+xfname(this.func)+")"
    }
    run(io) {
      return Pair(io.fst(),[])
        .mbind(this.target)
        .map(map(this.func))
        .map(map(x=>io.snd().append(x)))
    }
  }
  as(f) {return new Parser.As(this,f)}
  
  static Join=class Join extends Parser.Link {
    constructor(o,p) {
      super(o)
      this.func=p
    }
    setEx(ex) {return new Parser.Join(this.target.setEx(ex),this.func)}
    get expect() {return typeof this.func === "undefined" ? "("+this.target.expect+")->join()" : "("+this.target.expect+")->join(\""+this.func+"\")"}
    run(io) {
      return typeof this.func === "undefined" ? 
        this.target.as(mconcat)(io) : 
        this.target.as(o=>o.join(this.func))(io)   
    }
  }
  join(p) {return new Parser.Join(this,p)}

  static To=class To extends Parser.Link {
    constructor(o,tag) {
      super(o)
      this.tag=tag
    }
    setEx(ex) {return new Parser.To(this.target.setEx(ex),this.tag)}
    get expect() {return "("+this.target.expect+")->tagged as(\""+this.tag+"\")"}
    run(io) {
      const mktag=lr=>{
        // if(isLeft(r)) return r
        const fr=fromRight(lr)
        const r=fr.snd()
        const i=r.length===1?r[0]:r
        if(typeof io.snd().last()==="object") {
          io.snd().last()[this.tag]=i//no copy, modify object
          return Right(Pair(fr.fst(),io.snd()))
        }
        const ro={}
        ro[this.tag]=i
        r[r.length-1]=ro
        return Right(Pair(fr.fst(),io.snd().append(r)))
      }
      const r=this.target.post(mktag)(Pair(io.fst(),[]))
      return r
    }
  }
  to(tag) {return new Parser.To(this,tag)}
}

//meta-parsers ans parser compositions/alias
class Meta extends Parser.Link {
  constructor(iofunc,noFail,consumes) {
    super(iofunc)
    this.noFail=typeof noFail==="undefined"?true:noFail
    this.willConsume=typeof consumes==="undefined"?true:consumes
  }
  run(io){return this.target(io)}
  setEx(ex) {return this}
  canFail() {return !this.noFail}
  highOrder() {return this.noFail}
  consumes() {return this.willConsume}
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Combinators -----------------------------------------------------------------------------------//
//                                                                                                //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////
class None extends Parser {
  constructor() {
    super()
  }
  get expect() {return "none"}
  consumes() {return false}
  run(io) {return Right(io)}
}
//parser always succeedes without consuming
// also an "id" combinator to apply continuations on root elements
const none=new None()

class Skip extends Parser.Link {
  get expect() {return "skip "+this.target.expect}
  run(io) {return none.skip(this.target)(io)}
}
//apply skip (continuation) to the root element, using `none` combinator
const skip=o=>new Skip(quickParam(o))

class Satisfy extends Parser {
  constructor(chk) {
    super()
    this.ch=chk
  }
  get expect() {return this.ch.expect || "to satisfy condition"}
  canFail() {return this.ch.canFail}
  consumes() {return this.ch.consumes}
  run(io) {
    return this.ch(head(io.fst())) ?
      Right(//success...
        Pair(//build a pair of remaining input and composed output
          tail(io.fst()),//consume input
          io.snd().append([head(io.fst())])))//compose the outputs
      : Left(Pair(io.fst(), new Expect(this.expect)))//or report error
  }
}
//check a character with a boolean function
const satisfy=chk=>new Satisfy(chk)

const any=satisfy(isAnyChar)

class Str extends Parser {
  constructor(str) {
    super()
    this.str=str
  }
  get expect() {return "string `"+this.str+"`"}
  run(io) {
    return io.fst().startsWith?(
      io.fst().startsWith(this.str)?
        Right(Pair(io.fst().substr(this.str.length),io.snd().append(this.str))):
        Left(Pair(io.fst(),new Expect(this.expect)))
      ):(foldr1(a=>b=>b.then(a))(this.str.split("").map(o=>char(o))).join())(io)
  }
}
// //match a string
const string=str=>new Str(str)
// case-insensitive string match
const caseInsensitive=str=>new Meta(
  io=>(foldr1(a=>b=>b.then(a))(str.split("").map(o=>cases(o))).join())(io)
).failMsg("non case-sensitive form of string `"+str+"`")

class Regex extends Parser {
  constructor(e) {
    super()
    this.expr=RegExp(e,"y")
    this.expr.lastIndex=0
  }
  get expect() {return "regex "+this.expr}
  run(io) {
    const r=io.fst().match(this.expr)
    return r === null ?
      Left(Pair(io.fst(), new Expect(this.expect))) :
      Right(
        Pair(
          r.input.substr(r.index+r[0].length),
          r.length === 1 ? [r[0]] : r.slice(1, r.length)
        )
      )
  }
}
//regex match
const regex=e=>new Regex(e)

// //character parsers
const anyChar=satisfy(isAnyChar)
const char=c=>satisfy(isChar(c))
const cases=c=>satisfy(anyCase(c))
const oneOf=cs=>satisfy(isOneOf(cs))
const noneOf=cs=>satisfy(isNoneOf(cs))
const range=curry((a, z)=>satisfy(inRange(a, z)))
const digit=satisfy(isDigit)
const lower=satisfy(isLower)
const upper=satisfy(isUpper)
const letter=satisfy(isLetter)
const alphaNum=satisfy(isAlphaNum)
const hexDigit=satisfy(isHexDigit)
const octDigit=satisfy(isOctDigit)
const space=satisfy(isSpace).failMsg("space")
const tab=satisfy(isTab).failMsg("tab")
const nl=satisfy(is_nl).failMsg("new-line")
const cr=satisfy(is_cr).failMsg("carriage return")
const blank=satisfy(isBlank)
const eof=skip(satisfy(isEof))
const eol=skip(satisfy(isEol))

const optional=p=>new Meta(io=>p(io).or(Right(io))).failMsg("optional "+p.expect,true)//never fails
const choice=ps=>foldl1(a=>b=>a.or(b))(ps)

class Many extends Parser.Link {
  constructor(o){
    super(o)
    if(debugging&&o.consumes()&&!(o.safe()&&o.canFail())) clog("warning: many should not be requested with a parser that can not fail or might not consume")
  }
  get expect() {return "many("+this.target.expect+")"}//never fails
  static canFail() {return false}
  static consumes() {return false}
  safe() {return this.target.consumes()&&!(this.target.canFail()&&this.target.safe())}
  static highOrder() {return true}
  setEx(ex) {
    // if(ex.next.highOrder()) throw new Error("expecting character level parser here")
    if(!ex.next.root().highOrder())
      switch(ex.constructor.name) {
        case "Excluding": return many(this.target.excluding(ex.next.root()))
        case "LookAhead": return many(this.target.lookAhead(ex.next.root()))
        default:
          return many(this.target.excluding(ex.next.root()).or(this.target.lookAhead(ex.next.root())))
      }
  }
  run(io) {
    return this.target.then(many(this.target))(io).or(Right(io))
  }
}
const many=p=>new Many(p)

const many1=p=>(p.then(many(p))).failMsg("at least one "+p.expect)

const manyTill=curry((p,e)=>new Meta(
  io=>p.excluding(e).then(manyTill(p,e))(io).or(Right(io)),true
).failMsg("many "+p.expect+" until "+e.expect))//never fails

const count=curry((n,p)=>new Meta(
  io=>n ? p.then(count(n-1,p))(io) : Right(io),!p.canFail()
).failMsg(n+" of "+p.expect))

const between=curry((open,close,p)=>skip(open).then(p).skip(close))

const option=curry((x, p)=>new Meta(
  io=>p(io).or(Right(Pair(io.fst(), [x]))),true
).failMsg("option "+p.expect+" else "+x))//never fails

const optionMaybe=p=>new Meta(
  io=>p.as(Just)(io).or(Right(Pair(io.fst(), Nothing()))),true
).failMsg("maybe "+p.expect)//never fails

const sepBy=curry((p, sep)=> new Meta(
  io=>p.then(many(skip(sep).then(p)))(io).or(Right(io)),true
).failMsg(p.expect+" separated by "+sep.expect))//never fails

const sepBy1=curry((p,sep)=>p.then(many(skip(sep).then(p))).failMsg(p.expect+" separated by "+sep.expect))

const endBy=curry((p,sep)=>new Meta(//TODO: review this, can not use sepBy
  io=>sepBy(p)(sep).then(skip(sep))(io).or(Right(io)),!(sep.canFail()||p.canFail())
).failMsg(p.expect+" separated and ending with "+sep.expect))

const endBy1=curry((p,sep)=>sepBy1(p)(sep).then(skip(sep)).failMsg("at least one of "+p.expect+" separated and ending with "+sep.expect))

// high order character parser
const spaces=many(space).failMsg("spaces")
const spaces1=many1(space).failMsg("some space")
const blanks=many(blank).failMsg("white-space")
const blanks1=many1(blank).failMsg("some white-space")
const digits=many(digit).failMsg("digits")
const digits1=many1(digit).failMsg("some digits")
const letters=many(letter).failMsg("letters")
const letters1=many1(letter).failMsg("some letters")

// //interpret a result and enventually build an error message
const res=curry((fn, r)=>{
  if (isRight(r)) return r.map(snd)
  else {
    // fn=typeof fn==="undefined"?">":fn
    const rr=fromLeft(r)
    var fpos=fn
    if (typeof rr.fst().line !== "undefined") {
      const pos=rr.fst().getPos()
      fpos += ":"+pos.join(":")+"\n"
    }
    const found=head(rr.fst())//the char to blame
    return rr.snd().isError() ?
    Left(fpos+"error, "+rr.snd()) :
    Left(
        fpos+"error, expecting "+rr.snd()
       +" but found `"+(found || "eof")+"`"
       +(found?" here->"+rr.fst().toString().substr(0,10)+"...":"")//TODO: this is expensive, refactor! (functional `take n`)
      )
  }
})

const parse=curry((fn, p, str)=>res(fn)(p(Pair(str, []))))

if (!exports) var exports={}

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
exports.caseInsensitive=caseInsensitive
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
exports.Pair=Pair
exports.SStr=SStr
exports.Meta=Meta
exports.thenPrefix=thenPrefix

// exports.maps=maps

const chrono=(p,cnt,quiet)=>{
  clog(".")
  const start=new Date()
  for(var n=cnt;n;n--) p()
  const end=new Date()
  const elapsed=end-start
  const avg=elapsed/cnt
  if(!quiet)console.log(avg/1000,"s")
  return avg
}

const time=(p,n,q)=>io=>chrono(()=>p.parse(io),n||1,q)

exports.chrono=chrono
exports.time=time

// thenPrefix=skip(blanks)
