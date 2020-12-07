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

// const parserOf=e=>f=>{
//   clog("parserOf:",e)
//   Object.setPrototypeOf(f,new Parser(e,f))
//   return f
// }

class Parser extends Function {
  constructor() {
    super('...args', 'return this.__self__._run(...args)')
    var self=this.bind(this)
    this.__self__=self
    return self
  }
  _run(...args){
    // clog("parse:",args)
    // if(args[0]) clog(this.expect,"except",args.map(o=>o.expect))
    return this._parse(...args)
  }
  level() {return 0}
  setEx(ex) {}
  parse(s,ex) {return this(ex)(Pair(s, []))}
  // parse(s,ex) {return this(ex)(Pair(SStr(s), []))}
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
    setEx(ex) {this.target.setEx(ex)}
    level() {return this.target.level()+1}
  }
  //chain this parser to another
  static Chain=class extends Parser.Link {
    constructor(o,p) {
      super(o)
      this.next=p
    }
    level() {return this.target.level()+1}
  }
  static Then=class extends Parser.Chain {
    constructor(o,p) {
      super(o,p)
      if(p.level()===0) {
        clog("Then: setting",o.expect,"to exclude:",p.expect)
        o.setEx(p)
      }
    }
    get expect() {return this.target.expect+"\nthen "+this.next.expect}
    _parse(ex) {
      // if(this.next.level()==0) clog("excluding",this.next.expect)
      const nex=this.next.level()==0?this.next:undefined
      return io=>io.mbind(this.target(nex)).mbind(this.next(ex))
    }
  }
  then(p) {return new Parser.Then(this,p)}

  static Skip=class extends Parser.Chain {
    get expect() {return this.target.expect+"\nskip "+this.next.expect}
    _parse(ex) {
      return io=>{
        const os=io.mbind(this.target(this.next))
        return os.mbind(this.next(ex)).map(map(o=>snd(fromRight(os))))
      }
    }
  }
  skip(p) {return new Parser.Skip(this,p)}

  static LookAhead=class extends Parser.Chain {
    get expect() {return this.target.expect+" but look ahead for "+this.next.expect}
    _parse(ex) {
      return io=>{
        const r=this.target(ex)(io)
        const ps=r.mbind(this.next())
        if (isLeft(ps)) return ps
        return r
      }
    }
  }
  lookAhead(p) {return new Parser.LookAhead(this,p)}

  static Excluding=class extends Parser.Chain {
    get expect() {return this.target.expect+" excluding "+this.next.expect}
    _parse(ex) {
      return io=>{
        const ps=this.next(ex)(io)
        if (isRight(ps)) return Left(Pair(io.fst(), new Expect(this.expect)))
        return this.target(ex)(io)
      }
    }
  }
  excluding(p) {return new Parser.Excluding(this,p)}

  static NotFollowedBy=class extends Parser.Chain {
    get expect() {return this.target.expect+" excluding "+this.next.expect}
    _parse(ex) {
      return io=>{
        const os=this.target(ex)(io)
        const ps=os.mbind(this.next(ex))
        return isLeft(ps) ? os : Left(Pair(io.fst(), new Expect(this.expect)))
      }
    }
  }
  notFollowedBy(p) {return new Parser.NotFollowedBy(this,p)}

  static Or=class extends Parser.Chain {
    get expect() {return this.target.expect+" or "+this.next.expect}
    _parse(ex) {
      return io=>{
        const r=this.target(ex)(io)
        if (isRight(r)) return r;//break `or` parameter expansion
        return r.or(this.next(ex)(io)).or(Left(Pair(io.fst(), new Expect(this.expect))))
      }
    }
  }
  or(p) {return new Parser.Or(this,p)}

  static  FailMsg=class extends Parser.Link {
    constructor(o,msg) {
      super(o)
      this.msg=msg
    }
    get expect() {return this.msg}
    _parse(ex) {
      return io=>this.target(ex)(io).or(Left(Pair(io.fst(), new Error(this.msg))))
    }
  }
  failMsg(msg) {return new Parser.FailMsg(this,msg)}

  static As=class extends Parser.Link {
    constructor(o,f) {
      super(o)
      this.func=f
    }
    get expect() {
      const xfname=f=>{//aux
        const ff=f.name || f.toString()
        return ff.length < 15 ? ff : ff.substr(0, 12)+"..."
      }
      return "("+this.target.expect+")->as("+xfname(this.func)+")"
    }
    _parse(ex) {
      return io=>Pair(io.fst(),[])
        .mbind(this.target(ex))
        .map(map(this.func))
        .map(map(x=>io.snd().append(x)))
    }
  }
  as(f) {return new Parser.As(this,f)}
  
  static Join=class extends Parser.Link {
    constructor(o,p) {
      super(o)
      this.func=p
    }
    get expect() {return typeof p === "undefined" ? "("+this.target.expect+")->join()" : "("+this.target.expect+")->join(\""+this.func+"\")"}
    _parse(ex) {
      return io=>
        typeof p === "undefined" ? 
        this.target.as(mconcat)(ex)(io) : 
        this.target.as(o=>o.join(this.func))(ex)(io)   
    }
  }
  join(p) {return new Parser.Join(this,p)}
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

class Skip extends Parser.Link {
  constructor(p) {
    super(p)
  }
  get expect() {return "skip "+this.target.expect}
  _parse(ex) {return none.skip(this.target)(ex)}
}
//apply skip (continuation) to the root element, using `none` combinator
const skip=o=>new Skip(o)

class Satisfy extends Parser {
  constructor(chk) {
    super()
    this.ch=chk
  }
  get expect() {return this.ch.expect || "to satisfy condition"}
  _parse(ex) {
    return io=>{
      // clog("satisfy:",head(io.fst()))
      return this.ch(head(io.fst())) ?
      Right(//success...
        Pair(//build a pair of remaining input and composed output
          tail(io.fst()),//consume input
          io.snd().append([head(io.fst())])))//compose the outputs
      : Left(Pair(io.fst(), new Expect(this.expect)))//or report error
    }
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
  _parse(ex) {
    return io=>io.fst().startsWith(this.std)?Right(io.fst().substr(this.str.length),io.snd().append(this.str)):Left(this.expect)
    //above provided method is fater as expected... however error report is not at character level
    // return (foldr1(a=>b=>b.then(a))(this.str.split("").map(o=>char(o))).join())(ex)
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
const eof=satisfy(isEof)

//meta-parsers ans parser compositions/alias
class Meta extends Parser.Link {
  level() {return 2}
  _parse(ex){return this.target(ex)}
}
const optional=p=>new Meta(ex=>io=>p(ex)(io).or(Right(io))).failMsg("optional "+p.expect)//never fails

const choice=ps=>foldl1(a=>b=>a.or(b))(ps)

class Many extends Parser.Link {
  get expect() {return "many("+this.target.expect+")"}//never fails
  level() {return 2}
  setEx(ex) {
    clog("Meta::setEx",ex.expect,"on",this.expect)
    this.ex=ex}
  _parse(ex) {
    return io=>{
      clog("many target:",this.ex)
      if(this.ex) {
        clog("many",this.target.expect,"exluding",this.ex)
        return many(this.target.excluding(this.ex).or(this.target.lookAhead(this.ex)))()(io)
      }
      return this.target.then(many(this.target))(this.ex)(io).or(Right(io))
    }
  }
}
const many=p=>new Many(p)
// const many=p=>new Meta(
//   ex=>io=>{
//     if(ex) {
//       return many(new Meta(
//         (_=>i=>p.excluding(ex)()(i).or(p.lookAhead(ex)()(i)))
//       ).failMsg(p.expect+" but "+ex.expect))()(io)
//     }
//     return p.then(many(p))(ex)(io).or(Right(io))
//   }
// ).failMsg("many("+p.expect+")")//never fails

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

// high order character parser
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
exports.Pair=Pair
exports.SStr=SStr
exports.Meta=Meta

// exports.maps=maps

const chrono=(p,cnt)=>{
  const start=new Date()
  for(var n=cnt;n;n--) p()
  const end=new Date()
  const elapsed=end-start
  const avg=elapsed/cnt
  console.log(avg/1000,"s")
  return avg
}

const time=p=>io=>chrono(()=>p.parse(io),100)

exports.chrono=chrono
exports.time=time

clog(digits.join().then(digit).parse("121"))