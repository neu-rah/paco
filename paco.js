"use strict";

const { log, clog, xlog, debuging }=require("./src/debug")
const { Msg, Expect, Error }=require("./src/error")
const { SStr }=require("./src/strstr.js")

const {
  patchPrimitives,//patch primitive data types
  curry,//js curry style
  id, fcomp, fchain, constant, flip, cons,//Functional
  empty, append, mconcat,//Monoid
  head, tail,//List
  map,//Functor
  pure, mbind,//Monad
  Pair, fst, snd,//Pair (tupple)
  Maybe, isMaybe, Nothing, isNothing, Just, isJust, fromJust,//Maybe
  isEither, Left, isLeft, fromLeft, Right, isRight, fromRight,//Either
  foldable, foldr, foldl, foldr1, foldl1, foldMap,//foldable
}=require("funjs");

patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
)

//////////////////////////////////////////////////////////
// Parser

const {
  isAnyChar, isChar, isOneOf, isNoneOf, inRange,
  isDigit, isLower, isUpper, isLetter, isAlphaNum, isHexDigit, isOctDigit,
  isSpace, isTab, is_nl, is_cr, isBlank, isEof,
  Point, Set, Range,
}=require("./src/primitives")

const prim=require("./src/primitives")

const quickParam=p=>typeof p === "string" ? (p.length === 1 ? char(p) : string(p)) : p

const parserOf=e=>f=>{
  clog("parserOf:",e)
  Object.setPrototypeOf(f,new Parser(e,f))
  return f
}

class Parser extends Function {
  constructor() {
    super('...args', 'return this.__self__._parse(...args)')
    var self=this.bind(this)
    this.__self__=self
    return self
  }
  parse(s,ex) {return this(ex)(Pair(s, []))}
  // post(f) {return parserOf
  //   (this.expect+" verify of "+f)
  //   (ex=>io=>f(this(io)))}
  // chk(m,f) {return parserOf(this.expect+" check of "+f)
  //   (ex=>io=>{
  //     const r=this.failMsg(m)(io)
  //     if(isLeft(r)||f(fromRight(r).snd())) return r
  //     return Left(Pair(io.fst(),new Error(m)))
  //   })}

  //link something to this parser
  static Link=class extends Parser {
    constructor(o) {
      super()
      this.target=o
    }
  }
  //chain this parser to another
  static Chain=class extends Parser.Link {
    constructor(o,p) {
      super(o)
      this.next=p
    }
  }
  then(p) {
    class Then extends Parser.Chain {
      get expect() {return this.target.expect+"\nthen "+this.next.expect}
      _parse(ex) {return io=>io.mbind(this.target(this.next)).mbind(this.next(ex))}
    }
    return new Then(this,p)
  }

  skip(p) {
    class Skip extends Parser.Chain {
      get expect() {return o.expect+"\nskip "+p.expect}
      _parse(ex) {
        return io=>{
          const os=io.mbind(this.target(p))
          return os.mbind(p(ex)).map(map(o=>snd(fromRight(os))))
        }
      }
    }
    return new Skip(this,p)
  }

  lookAhead(p) {
    class LookAhead extends Parser.Chain {
      get expect() {return o.expect+" but look ahead for "+p.expect}
      _parse(ex) {
        return io=>{
          const r=this.target(ex)(io)
          const ps=r.mbind(p())
          if (isLeft(ps)) return ps
          return r
        }
      }
    }
    return new LookAhead(this,p)
  }

  excluding(p) {
    class Excluding extends Parser.Chain {
      get expect() {return this.target.expect+" excluding "+this.next.expect}
      _parse(ex) {
        return io=>{
          const ps=p(ex)(io)
          if (isRight(ps)) return Left(Pair(io.fst(), new Expect(this.expect)))
          return this.target(ex)(io)
        }
      }
    }
    return new Excluding(this,p)
  }

  notFollowedBy(p) {
    class NotFollowedBy extends Parser.Chain {
      get expect() {return o.expect+" excluding "+p.expect}
      _parse(ex) {
        return io=>{
          const os=this.target(ex)(io)
          const ps=os.mbind(this.next(ex))
          return isLeft(ps) ? os : Left(Pair(io.fst(), new Expect(this.expect)))
        }
      }
    }
    return new NotFollowedBy(this,p)
  }

  or(p) {
    class Or extends Parser.Chain {
      get expect() {return this.target.expect+" or "+this.next.expect}
      _parse(ex) {
        return io=>{
          const r=this.target(ex)(io)
          if (isRight(r)) return r;//break `or` parameter expansion
          return r.or(p(ex)(io)).or(Left(Pair(io.fst(), new Expect(this.expect))))
        }
      }
    }
    return new Or(this,p)
  }

  failMsg(msg) {
    class FailMsg extends Parser.Link {
      constructor(o,msg) {
        super(o)
        this.msg=msg
      }
      get expect() {return this.msg}
      _parse(ex) {
        return io=>this.target(ex)(io).or(Left(Pair(io.fst(), new Error(this.msg))))
      }
    }
    return new FailMsg(this,msg)
  }

  as(f) {
    class As extends Parser.Link {
      constructor(o,f) {
        const xfname=f=>{//aux
          const ff=f.name || f.toString()
          return ff.length < 15 ? ff : ff.substr(0, 12)+"..."
        }
        super(o)
        this.func=f
      }
      get expect() {return "("+o.expect+")->as("+xfname(f)+")"}
      _parse(ex) {return io=>Pair(io.fst(),[]).mbind(this.target(ex)).map(map(f)).map(map(x=>io.snd().append(x)))}
    }
    return new As(this,f)
  }
  
  join(p) {
    class Join extends Parser.Link {
      constructor(o,p) {
        super(o)
        this.func=p
      }
      get expect() {return typeof p === "undefined" ? "("+o.expect+")->join()" : "("+o.expect+")->join(\""+p+"\")"}
      _parse(ex) {
        return io=>
          typeof p === "undefined" ? 
          this.target.as(mconcat)(ex)(io) : 
          this.target.as(o=>o.join(this.func))(ex)(io)   
      }
    }
    return new Join(this,p)
  }
}

// Combinators --------------
class None extends Parser {
  constructor() {
    super()
  }
  get expect() {return "none"}
  _parse(_) {return o=>Right(o)}
}
//parser always succeedes without consuming
// also an "id" combinator to apply continuations on root elements
const none=new None()

class Skip extends Parser {
  constructor(p) {
    super()
    this.next=p
  }
  get expect() {return "skip "+this.next.expect}
  _parse(ex) {return none.skip(this.next)(ex)}
}
//apply skip (continuation) to the root element, using `none` combinator
const skip=o=>new Skip(o)

class Satisfy extends Parser {
  constructor(chk) {
    super()
    this.chk=chk
  }
  get expect() {return this.chk.expect || "to satisfy condition"}
  _parse(ex) {
    return io=>{return this.chk(head(io.fst())) ?
      Right(//success...
        Pair(//build a pair of remaining input and composed output
          tail(io.fst()),//consume input
          io.snd().append([head(io.fst())])))//compose the outputs
      : Left(Pair(io.fst(), new Expect(this.expect)))//or report error
    }
  }
}
// //check a character with a boolean function
const satisfy=chk=>new Satisfy(chk)
const any=satisfy(isAnyChar)

class Str extends Parser {
  constructor(str) {
    super()
    this.str=str
  }
  get expect() {return "string `"+str+"`"}
  _parse(ex) {
    return (foldr1(a=>b=>b.then(a))(this.str.split("").map(o=>char(o))).join())(ex)
  }
}
// //match a string
const string=str=>new Str(str)

class Regex extends Parser {
  constructor(e) {
    super()
    this.expr=e
  }
  get expect() {return "regex /"+this.expr+"/"}
  _parse(ex) {
    return io=>{
      const r=io.fst().match(this.expr)
      return r === null ?
        Left(Pair(io.fst(), new Expect(this.expect))) :
        Right(
          Pair(
            r.input.substr(r[0].length),
            r.length === 1 ? [r[0]] : r.slice(1, r.length)
          )
        )
    }
  }
}
//regex match
const regex=e=>new Regex(e)

// //character parsers
const anyChar=satisfy(isAnyChar)
const char=c=>satisfy(isChar(c))
const oneOf=cs=>satisfy(isOneOf(cs))
const noneOf=cs=>satisfy(isNoneOf(cs))
const range=curry((a, z)=>parserOf(inRange(a, z).expect)(c=>satisfy(inRange(a, z))(c)))
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
const eof=satisfy(isEof)

//meta-parsers ans parser compositions/alias
class Meta extends Parser.Link {_parse(ex){return this.target(ex)}}
const optional=p=>new Meta(ex=>io=>p(ex)(io).or(Right(io))).failMsg("optional "+p.expect)//never fails

const choice=ps=>foldl1(a=>b=>a.or(b))(ps)

const many=p=>new Meta(
  ex=>io=>{
    if(ex) {
      return many(
        parserOf(p.expect+" but "+ex.expect)
        (_=>i=>p.excluding(ex)()(i).or(p.lookAhead(ex)()(i)))
      )()(io)
    }
    return p.then(many(p))(ex)(io).or(Right(io))
  }
).failMsg("many("+p.expect+")")//never fails

const many1=p=>(p.then(many(p))).failMsg("at least one "+p.expect)

const manyTill=curry((p,e)=>new Meta(
  ex=>io=>p.excluding(e).then(manyTill(p,e))()(io).or(Right(io))
).failMsg("many "+p.expect+" until "+e.expect))//never fails

const count=curry((n,p)=>new Meta(
  ex=>io=>n ? p.then(count(n-1,p))(ex)(io) : Right(io)
).failMsg(n+" of "+p.expect))

const between=curry((open,close,p)=>skip(open).then(p).skip(close))

const option=curry((x, p)=>new Meta(
  ex=>io=>p(ex)(io).or(Right(Pair(io.fst(), x)))
).failMsg("option "+p.expect+" else "+x))

const optionMaybe=p=>new Meta(
  ex=>io=>p.as(Just)(ex)(io).or(Right(Pair(io.fst(), Nothing())))
).failMsg("maybe "+p.expect)

const sepBy=curry((p, sep)=> new Meta(
  ex=>io=>p.then(many(skip(sep).then(p)))(ex)(io).or(Right(io))
).failMsg(p.expect+" separated by "+sep.expect))//never fails

const sepBy1=curry((p,sep)=>p.then(many(skip(sep).then(p))).failMsg(p.expect+" separated by "+sep.expect))

const endBy=curry((p,sep)=>new Meta(
  ex=>io=>sepBy(p)(sep).then(skip(sep))(ex)(io).or(Right(io))
).failMsg(p.expect+" separated and ending with "+sep.expect))

const endBy1=curry((p,sep)=>sepBy1(p)(sep).then(skip(sep)).failMsg("at least one of "+p.expect+" separated and ending with "+sep.expect))

//high order character parser
const spaces=many(space).failMsg("spaces")
const spaces1=many1(space).failMsg("some space")
const blanks=many(blank).failMsg("white space")
const blanks1=many1(blank).failMsg("some white space")
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

const parse=curry((fn, p, str)=>res(fn)(p()(Pair(str, []))))

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
exports.Pair=Pair
exports.SStr=SStr