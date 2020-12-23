"use strict";

var it=exports?global:this
if(!exports) var exports={}

Object.assign(it,require("./src/debug"))
Object.assign(it,require("rsite-funjs"))
patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
  Object().__proto__,
)

Object.assign(it,require("./src/error"))
const cdom=require("./src/cdom");
const {clog}=require("./src/debug");
  
var config={
  optimize:false,//all optimizations
  backtrackExclusions: debugging//exclude next selector root from current loop match
}

const quickParam=p=>typeof p === "string" ? (p.length === 1 ? is(p) : string(p)) : p
const consume=o=>io=>o.consume(io)
const ranges=o=>o.ranges()

class Parser {
  get expect() {return (this.msg||(this.msg=this.name))/*.split("\\").join("\\\\")*/}
  fail(io) {return Left(Pair(new Expect(this.expect),io.snd()))}
  failMsg(msg) {this.msg=msg;return this}
  //top level, check and formats params, can accept a string to initiate the io object
  parse(io) {io=io||"";return this.run(typeof io==="string"?Pair([],io):io)}
  //low level parsing, this is the default for a parser
  //chains and mods can do otherwise (override)
  chk(o) {return false}
  run(io) {return this.chk(io.snd().head())?this.consume(io):this.fail(io)}
  get parser() {return this.run.bind(this)}
  highOrder() {return false}
  root() {return this}
  same(o) {return this.sameCons(o)}
  sameCons(o) {return this.constructor===o.constructor}
  optimize() {return config.optimize?this.optim():this}
  optim() {return this}
  exclude(ex) {return this}
  ranges() {return cdom.any}
  loop() {return false}

  /////////////////////////////////////////////////////////////////////////
  // modifiers
  static Mod=class Mod extends Parser {
    constructor(target) {
      super()
      this.target=target
    }
    run(io) {return this.target.run()}
    chk(o) {return this.target.chk(o)}
    highOrder() {return this.target.highOrder()}
    root() {return this.target.root()}
    ranges() {return this.target.ranges()}
    same(o) {return this.target.same(o)}
    optim() {
      this.target=this.target.optim()
      return this
    }
    exclude(ex) {
      this.target=this.target.exclude(ex)
      return this
    }
    loop() {return this.target.loop()}
  }

  static Post=class Post extends Parser.Mod {
    constructor(o,f) {
      super(o)
      this.func=f
    }
    get name() {return "["+this.target.expect+"]->Post process"}
    run(io) {return this.func(this.target.run(io))}
  }
  post(f) {return new Parser.Post(this,f).optimize()}

  static Verify=class Verify extends Parser.Post {
    get name() {return "["+this.target.expect+"]->verify!"}
    run(io) {
      const r=this.target.run(Pair([],io.snd()))
      if(isLeft(r)) return r
      const rr=fromRight(r)
      if(this.func(rr.fst())) return Right(Pair(io.fst().append(rr.fst()),rr.snd()))
      return this.fail(io)
    }
  }
  verify(f,m) {return new Parser.Verify(this,f,m).optimize()}

  /////////////////////////////////////////////////////////////////////////
  // chains
  static Chain=class Chain extends Parser.Mod {
    constructor(target,next) {
      super(target)
      this.next=next
    }
    optim() {
      this.target.optim()
      this.next.optim()
      if((!this.op)&&this.target.highOrder()&&!this.next.highOrder()) {
        this.op=true
        if(config.backtrackExclusions) this.target=this.target.exclude(this)
      }        
      return this
    }
    highOrder() {return this.target.highOrder()||this.next.highOrder()}
  }

  static As=class As extends Parser.Mod {
    constructor(o,f) {
      super(o)
      this.func=f
    }
    get name() {
      const xfname=f=>{//aux
        if(debugging) {
          const ff=f.name || f.toString()
          return ff.length < 15 ? ff : ff.substr(0, 12)+"..."
        }
        return f.name || "..."//do not show code!
      }
      return debugging?"("+this.target.expect+")->as("+xfname(this.func)+")":this.target.expect
    }
    run(io) {
      return Pair([],io.snd())
        .mbind(this.target.parser)
        .map(o=>Pair(io.fst().append(this.func(o.fst())),o.snd()))
    }
  }
  as(f) {return new Parser.As(this,f).optimize()}
  static Join=class Join extends Parser.As {
    constructor(t,sep) {
      super(t,o=>o.join(sep))
    }
    loop() {return false}
  }
  join(sep="") {return new Parser.Join(this,sep)}

  static Then=class Then extends Parser.Chain {
    get name() {return this.target.expect+" then "+this.next.expect}
    run(io) {return io.mbind(this.target.parser).mbind(this.next.parser)}
  }
  _then(o) {return new Parser.Then(this,o)}
  then(o) {return this._then(quickParam(o)).optimize()}

  static Skip=class Skip extends Parser.Then {
    get name() {return this.target.expect+" skip "+this.next.expect}
    run(io) {
      const os=io.mbind(this.target.parser)
      return os.mbind(this.next.parser).mbind(o=>Right(Pair(fromRight(os).fst(),o.snd())))
    }
  }
  _skip(o) {return new Parser.Skip(this,o)}
  skip(o) {return this._skip(quickParam(o).optimize())}

  static LookAhead=class LookAhead extends Parser.Chain {
    get name() {return this.target.expect+" followed by "+this.next.expect}
    run(io) {
      const r=this.target.run(io)
      const ps=r.mbind(this.next.parser)
      if (isLeft(ps)) return ps
      return r
    }
  }
  _lookAhead(o) {return new Parser.LookAhead(this,o)}
  lookAhead(o) {return this._lookAhead(quickParam(o)).optimize()}

  static Excluding=class Excluding extends Parser.Chain {
    get name() {return this.target.expect+" excluding "+this.next.expect}
    chk(o) {return this.target.chk(o)&&!this.next.chk(o)}
    run(io) {
      const ps=this.next.run(io)
      if (isRight(ps)) return this.fail(io)
      return this.target.run(io)
    }
  }
  _excluding(o) {return new Parser.Excluding(this,o)}
  excluding(o) {return this._excluding(quickParam(o)).optimize()}

  static NotFollowedBy=class NotFollowedBy extends Parser.Chain {
    get name() {return this.target.expect+" not followed by "+this.next.expect}
    run(io) {
      const os=this.target.run(io)
      const ps=os.mbind(this.next.parser)
      return isLeft(ps) ? os : this.fail(io)
    }
  }
  _notFollowedBy(o) {return new Parser.NotFollowedBy(this,o)}
  notFollowedBy(o) {return this._notFollowedBy(quickParam(o)).optimize()}

  or(o) {return _match(this,o)}

  static To=class To extends Parser.Mod {
    constructor(o,tag) {
      super(o)
      this.tag=tag
    }
    get name() {return "("+this.target.expect+")->tagged as(\""+this.tag+"\")"}
    run(io) {
      const o=this.target.run(Pair([],io.snd()))
      if(o.isLeft()) return o
      const r=o.fromRight()
      var i=io.fst()
      const rv=!this.loop()&&r.fst().length===1?r.fst()[0]:r.fst()
      if(i.length&&typeof i.last()==="object")
        i.last()[this.tag]=rv
      else {
        const ro={}
        ro[this.tag]=rv
        i.push(ro)
      }
      return Right(Pair(i,r.snd()))
    }
  }
  to(tag) {return new Parser.To(this,tag).optimize()}

}

/////////////////////////////////////////////////////////////////////////////////////////////
// parsers
//
/////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////

class CharParser extends Parser {
  consume(io) {return Right(Pair(io.fst().append(head(io.snd())),tail(io.snd())))}
}

class Sel extends CharParser {
  constructor(sel) {super();this.sel=sel}
}

class Any extends CharParser {
  chk(o) {return typeof o!=="undefined"}
}
const any=new Any()

class Is extends Sel {
  get name() {return "'"+this.sel+"'"}
  same(o) {return this.sameCons(o)&&this.sel[0]===o.sel[0]}
  chk(o) {return this.sel===o}
  ranges() {return cdom.range(this.sel,this.sel)}
}
const is=o=>new Is(o)

class Str extends Sel {
  get name() {return this.msg||("string \""+this.sel+"\"")}
  same(o) {return this.sameCons(o)&&this.sel===o.sel}
  ranges() {return cdom.range(this.sel.head(),this.sel.head())}
  consume(io) {return Right(Pair(io.fst().append(this.sel),io.snd().substr(this.sel.length)))}
  run(io) {
    return io.snd().startsWith?(//is it a string?
      io.snd().startsWith(this.sel)?this.consume(io):this.fail(io)
    ):(foldr1(a=>b=>b._then(a,true))(this.str.split("").map(o=>is(o))).join())(io)
  }
}
const string=s=>new Str(s)

class Range extends CharParser {
  constructor(a,z) {
    super()
    this.a=a
    this.z=z
  }
  get name() {return this.msg||("'"+this.a+"' to '"+this.z+"'")}
  same(o) {return this.sameCons(o)&&this.a===o.a&&this.z===o.z}
  chk(o) {return this.a<=o&&o<=this.z}
  ranges() {return cdom.range(this.a,this.z)}
}
const range=(a,z,m)=>new Range(a,z,m)

const Match=class Match extends CharParser {
  constructor(...oo) {
    super()
    this.sel=oo
  }
  get name() {return this.sel.map(x=>x.expect).join(" or ")}
  highOrder() {return true}//TODO: add rules for this and remove highOrder
  run(io) {
    const orChk=oo=>{
      if(!oo.length) return this.fail(io)
      var r=oo.head().run(io)
      if(isRight(r)) return r
      return orChk(oo.tail())
    }
    return orChk(this.sel)
  }
  chk(o) {return this.sel.foldr(a=>b=>a.chk(o)||b)(false)}
  ranges() {return cdom.union(...this.sel.map(ranges))}
}
const _match=(...oo)=>new Match(...oo)
const match=(...oo)=>_match(...oo.map(quickParam))

class OneOf extends Sel {
  get name() {return "one of \""+this.sel+"\""}
  chk(o) {return this.sel.indexOf(o)!==-1}
  ranges() {return cdom.union(...this.sel.split("").map(o=>is(o).ranges()))}
}
const oneOf=sel=>new OneOf(sel)

class NoneOf extends Sel {
  get name() {return "none of \""+this.sel+"\""}
  chk(o) {return this.sel.indexOf(o)===-1}
  ranges() {
    const l=this.sel.split("")
    const p=l.zipWith(a=>z=>cdom.range(cdom.next(a),cdom.prev(z)))(l.tail())
    return cdom.union(cdom.lt(l.head()),...p,cdom.gt(l.last()))
  }

}
const noneOf=sel=>new NoneOf(sel)

class Many extends Parser.Mod {
  get name() {return "many ["+this.target.expect+"]"}
  highOrder() {return true}
  exclude(ex) {
    if(config.backtrackExclusions&&!ex.next.root().highOrder()) {
      const i=cdom.intersect(this.ranges(),ex.next.ranges()).simplify()
      clog("backtrackExclusions",
      i.reverse()
        .map(x=>x.toString())
        .join(" ⇔ ")
        .split("\n").join("\\n")
        .split("\r").join("\\r")
        .split("\t").join("\\t")
      ,(i.reverse(),""))
      if(i.length===1||i.head().isEmpty()) return this
      clog("excluding...",i.head()+"")
      switch(ex.constructor.name) {
        case "Excluding": return many(this.target.excluding(ex.next.root(),true))
        case "LookAhead": return many(this.target.lookAhead(ex.next.root(),true))
        default:
          return many(
            this.target.excluding(ex.next.root())
            .or(this.target.lookAhead(ex.next.root()))
          )
      }
    }
    return this
  }
  run(io) {return this.target._then(_many(this.target),true).run(io).or(Right(io))}
  loop() {return true}
}
const _many=(o,m)=>new Many(o,m)
const many=(o,m)=>_many(quickParam(o),m).optimize()

const _some=p=>(p._then(_many(p),true)).failMsg("at least one "+p.expect)
const some=p=>_some(quickParam(p))

class None extends Parser {
  get name() {return "none"}
  run(io) {return Right(io)}
  ranges() {return cdom.none}
}
const none=new None()

class Regex extends Parser {
  constructor(e) {
    super()
    this.expr=RegExp(e,"y")
    this.expr.lastIndex=0
  }
  get name() {return "regex "+this.expr}
  run(io) {
    const r=io.snd().match(this.expr)
    return r === null ?
      Left(Pair(new Expect(this.expect),io.snd())) :
      Right(
        Pair(
          r.length === 1 ? [r[0]] : r.slice(1, r.length),
          r.input.substr(r.index+r[0].length)
        )
      )
  }
}
//regex match
const regex=e=>new Regex(e)

class ManyTill extends Parser.Mod {
  constructor(p,e) {
    super(p)
    this.end=e
  }
  get name() {return "many "+this.target.expect+" until "+this.end.expect}
  highOrder() {return true}
  run(io) {return this.target._excluding(this.end)._then(_manyTill(this.target,this.end)).run(io).or(Right(io))}
  loop() {return true}
}
const _manyTill=(p,e)=>new ManyTill(p,e)
const manyTill=curry((p,e)=>_manyTill(quickParam(p),quickParam(e)).optimize())

class Count extends Parser.Mod {
  constructor(n,p) {
    super(p)
    this.cnt=n
  }
  get name() {return this.cnt+" of "+this.target.expect}
  root() {return this}
  run(io) {return this.cnt ? this.target._then(_count(this.cnt-1,this.target)).run(io) : Right(io)}//TODO: use a cycle instead!
  loop() {return true}
}
const _count=(n,p)=>new Count(n,p)
const count=curry((n,p)=>_count(n,quickParam(p)).optimize())

class Between extends Parser.Mod {
  constructor(o,c,p) {
    super(p)
    this.open=o
    this.close=c
  }
  get name() {return this.target.expect+" between "+this.open.expect+" and "+this.close.expect}
  run(io) {return _skip(this.open)._then(this.target)._skip(this.close).run(io)}
}
const _between=(open,close,p)=>new Between(open,close,p)
const between=curry((open,close,p)=>_between(
  quickParam(open),
  quickParam(close),
  quickParam(p)).optimize())

class Option extends Parser.Mod {
  constructor(x,p) {
    super(p)
    this.default=x
  }
  get name() {return "option "+this.target.expect+" else "+this.default}
  run(io) {return this.target.run(io).or(Right(Pair([this.default],io.snd())))}
}
const _option=(x, p)=>new Option(x,p)
const option=curry((x, p)=>_option(x,quickParam(p)).optimize())

class OptionMaybe extends Parser.Mod {
  get name() {return "maybe "+p.expect}
  run(io) {return this.target.as(Just).run(io).or(Right(Pair(Nothing(),io.snd())))}
}
const _optionMaybe=p=>new OptionMaybe(p)
const optionMaybe=(p=>_optionMaybe(quickParam(p)).optimize())

class SepBy extends Parser.Mod {
  constructor(p,sep) {
    super(p)
    this.sep=sep
  }
  get name() {return this.target.expect+" separated by "+this.sep.expect}//never fails
  highOrder() {return true}
  run(io) {return this.target._then(_many(_skip(this.sep)._then(this.target))).run(io).or(Right(io))}
  loop() {return true}
}
const _sepBy=(p, sep)=>new SepBy(p,sep)
const sepBy=curry((p, sep)=>_sepBy(quickParam(p),quickParam(sep)).optimize())

class SepBy1 extends SepBy {
  get name() {return this.target.expect+" separated by "+this.sep.expect}
  run(io) {return this.target._then(_many(_skip(this.sep)._then(this.target))).run(io)}
  loop() {return true}
}
const _sepBy1=(p,sep)=>new SepBy(p,sep)
const sepBy1=curry((p,sep)=>_sepBy1(quickParam(p),quickParam(sep)).optimize())

class EndBy extends SepBy {
  get name() {return this.target.expect+" separated and ending with "+this.sep.expect}
  run(io) {return _sepBy(p,sep)._then(_skip(sep)).run(io).or(Right(io))}
  loop() {return true}
}
const _endBy=(p,sep)=>new EndBy(p,sep)
const endBy=curry((p,sep)=>_endBy(quickParam(p),quickParam(sep)).optimize())
  
class EndBy1 extends EndBy {
  get name() {return "at least one of "+this.target.expect+" separated and ending with "+this.sep.expect}
  run(io) {return _sepBy1(this.target,this.sep)._then(_skip(this.sep),true).run(io)}
}
const _endBy1=(p,sep)=>new EndBy1(p,sep)
const endBy1=curry((p,sep)=>_endBy1(quickParam(p),quickParam(sep)).optimize())

class Skip extends Parser.Mod {
  get name() {return "skip "+this.target.expect}
  run(io) {return none._skip(this.target).run(io)}
}
const _skip=o=>new Skip(o)
const skip=o=>_skip(quickParam(o)).optimize()

const digit=range('0','9').failMsg("digit")
const octDigit=range('0','7').failMsg("octal digit")
const hexDigit=match(digit,range('a','f'),range('A','F')).failMsg("hexadecimal digit")
const lower=range('a','z').failMsg("lower-case")
const upper=range('A','Z').failMsg("upper-case")
const letter=match(lower,upper).failMsg("letter")
const alphaNum=match(lower,upper,digit).failMsg("alpha-numeric")
const space=new Is(' ').failMsg("space")
const tab=new Is('\t').failMsg("tab")
const nl=new Is('\n').failMsg("new-line")
const cr=new Is('\n').failMsg("carriage return")
const blank=match(space,tab).failMsg("white-space")

// Satisfy function: Char->Bool
class Satisfy extends Sel {
  same(o) {return this.sel===o.sel}
  chk(o) {return this.sel(o)}
} const satisfy=(f,m)=>new Satisfy(f,m)

class EOF extends CharParser {
  get name() {return "end-of-file"}
  chk(o) {return typeof o==="undefined"}
  consume(io) {return Right(io)}
} const eof=new EOF()
const eol=_match(nl,eof).failMsg("end of line or file")

class Optional extends Parser.Mod {
  get name() {return "optional "+this.target.expect}
  run(io) {return this.target.run(io).or(Right(io))}
}
const _optional=p=>new Optional(p)
const optional=p=>_optional(quickParam(p)).optimize()
const choice=ps=>foldl1(a=>b=>a.or(b))(ps)

const digits=many(digit).failMsg("digits")
const spaces=many(space).failMsg("spaces")
const blanks=many(blank)
const letters=many(letter)

/////////////////////////////////////////////////////////////////////////////////////////////////////
// top level parsing and results

// //interpret a result and enventually build an error message
const res=curry((fn, r)=>{
  if (isRight(r)) return r.map(fst)
  else {
    // fn=typeof fn==="undefined"?">":fn
    const rr=fromLeft(r)
    var fpos=fn
    if (typeof rr.snd().line !== "undefined") {
      const pos=rr.fst().getPos()
      fpos += ":"+pos.join(":")+"\n"
    }
    const found=head(rr.snd())//the char to blame
    return rr.fst().isError() ?
    Left(fpos+"error, "+rr.fst()) :
    Left(
        fpos+"error, expecting "+rr.fst()
       +" but found `"+(found || "eof")+"`"
       +(found?" here->"+rr.snd().toString().substr(0,10)+"...":"")//TODO: this is expensive, refactor! (functional `take n`)
      )
  }
})

const parse=curry((fn, p, str)=>res(fn)(p.run(Pair([],str))))

/////////////////////////////////////////////////////////////////////////////////
// exporting
exports.satisfy=satisfy
exports.anyChar=any
exports.char=is
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
exports.spaces1=some(space)
exports.blanks1=some(blank)
exports.digits=digits
exports.eof=eof
exports.string=string
// exports.caseInsensitive=caseInsensitive
exports.regex=regex

exports.none=none
exports.skip=skip
exports.many=many
exports.many1=some//many1 deprecated, use some
exports.some=some
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
// exports.SStr=SStr
exports.config=config
exports.Parser=Parser

const char=is

