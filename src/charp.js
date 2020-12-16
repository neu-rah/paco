"use strict";

//this is slower than primitives.js
// same file 0.85 -> 1.15

var it=exports?global:this
if(!exports) var exports={}

const {log,clog,xlog,mxlog,debugging}=require("./debug.js")
Object.assign(it,require("rsite-funjs"))

patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
  Object().__proto__,
)

const neg=o=>o.neg()
const expect=o=>o.expect
const simpl=o=>o.simpl()
const simplify=o=>o.simplify()
const exclude=o=>e=>o.exlude(e)
const union=o=>u=>o.union(u)
const prev=o=>String.fromCharCode(o.charCodeAt(0)-1)
const next=o=>String.fromCharCode(o.charCodeAt(0)+1)

const diff=a=>b=>{
  if(a.isEmpty()) return []
  if(b.isEmpty()) return a
  if(a.head().same(b.head())) return diff(a.tail())(b.tail())
  return diff(cons(a.head(),(diff(a.tail())([b.head()]))))(b.tail())
}

class CharParser extends Function {
  constructor() {
    super('...args', 'return this.__self__.match(...args)')
    var self=this.bind(this)
    this.__self__=self
    return self
  }
  same(o) {return o.constructor===this.constructor}
  neg() {return not(this)}
  simpl() {return Nothing()}
  simplify() {
    clog("CharParser("+this.constructor.name+")::simplify")
    const r=this.simpl()
    return mplus(r.mbind(simplify))(r)}
}

class Any extends CharParser {
  get expect() {return "any character"}
  get canFail() {return true}
  get consumes() {return true}
  match(o) {return true}
  neg() {return none}
  exclude(o) {return o.neg()}
  union(o) {return this}
}
const any=new Any()

class None extends CharParser {
  get expect() {return "no character"}
  get canFail() {return true}
  get consumes() {return false}
  match(o) {return false}
  neg() {return any}
  exclude(o) {return this}
  union(o) {return o}
}
const none=new None()

class Selector extends CharParser {
  constructor(sel,msg){
    super()
    this.sel=sel
    this.msg=msg
  }
  get expect() {return this.msg}
  same(o) {return super.same(o)&&this.sel===o.sel}
}

class Is extends Selector {
  get expect() {return "character '"+this.sel+"'"}
  match(o) {return this.sel===o}
  exclude(o) {return o(this.sel)?none:this}
  union(o) {
    switch(o.constructor) {
      case Any: return any
      case Is:
      case OneOf: return oneOf(this.sel+o.sel)
      default: return o(this.sel)?o:or(this,o)
    }
  }
}
const is=c=>new Is(c)

class Cases extends Selector {
  get expect() {return "any case of '"+this.sel+"'"}
  match(o) {return o.toLowerCase()===c.toLowerCase()}
  union(o) {
    if(o(this.sel.toLowerCase())) return is(this.sel.toUpperCase()).union(o)
    if(o(this.sel.toUpperCase())) return is(this.sel.toLowerCase()).union(o)
    return or(this,o)
  }
  exclude(o) {
    if(o(this.sel.toLowerCase())) return is(this.sel.toUpperCase()).exclude(o)
    if(o(this.sel.toUpperCase())) return is(this.sel.toLowerCase()).exclude(o)
    return this
  }
}
const cases=c=>new Cases(c)

class StringSel extends Selector {
  _simpl(np) {
    const oo=this.sel.split("").sort()
    if(!oo.length) return Just(none)
    var at
    var r=[]
    for(var n of oo) {
      if(n===at) continue
      at=n
      r.push(n)
    }
    return r.length===this.sel.length?Nothing():Just(np(r.join()))
  }
}

class OneOf extends StringSel {
  get expect() {return "one of \""+this.sel+"\""}
  match(o) {return this.sel.indexOf(o)!=-1}
  neg() {return noneOf(this.sel)}
  exclude(o) {return or(...this.sel.split("").map(x=>is(x).exclude(o)))}
  union(o) {
    switch(o.constructor) {
      case Any: any
      case Is:
      case OneOf: return oneOf((this.sel+o.sel).unique())
      case NoneOf: 
        return noneOf(o.sel.filter(x=>!this(x))+this.sel.filter(x=>!o(x)))
      case Range: return or(o,oneOf(this.sel.filter(x=>!o(x))))
      default: break
    }
    return or(this,o)
  }
  decomp() {return or(...this.sel.split("").map(x=>is(x)))}
  simpl() {
    clog("OneOf::simpl",this.expect)
    return this._simpl(oneOf)}
}
const oneOf=s=>new OneOf(s)

class NoneOf extends StringSel {
  get expect() {return "none of \""+this.sel+"\""}
  match(o) {return this.sel.indexOf(o)===-1}
  neg() {return oneOf(this.sel)}
  exclude(o) {return and(...this.sel.split("").map(x=>not(is(x)).exclude(o)))}
  union(o) {
    switch(o.constructor) {
      case Any: return any
      case Is: 
      case OneOf:
      case NoneOf: return noneOf(this.sel.filter(x=>!o(x)))
      case Range: return or(o,noneOf(this.sel.filter(x=>!o(x))))
      //case Not:
      // case Or:
      // case And:
      default: break
    }
    return or(this,o)
  }
  decomp() {return and(...this.sel.split("").map(x=>not(is(x))))}
  simpl() {return this._simpl(noneOf)}
}
const noneOf=s=>new NoneOf(s)

class Not extends Selector {
  get expect() {return "not "+this.sel.expect}
  match(o) {return !this.sel.match(o)}
  neg() {return this.sel}
  exclude(o) {return not(this.sel.exclude(o))}
  simpl() {
    clog("Not::simpl",this.expect)
    return this.sel.neg()===this?Nothing():Just(this.sel.neg())}
}
const not=p=>new Not(p)

class Range extends CharParser {
  constructor(a,z,msg){
    super()
    this.from=a
    this.to=z
    this.msg=msg
  }
  get expect() {return this.msg||"range '"+this.from+"' to '"+this.to+"'"}
  same(o) {return super.same(o)&&this.from===o.from&&this.to===o.to}
  match(o) {return this.from<=o&&o<=this.to}
  union(o) {
    switch(o.constructor) {
      case Any: return any
      case Is: 
      case OneOf:
      case NoneOf: //return o.union(this)
        return noneOf(o.sel.filter(x=>!this(x)))
      case Range:
        if(this.from<=o.from&&o.to<=this.to) return this
        if(o.from<=this.from&&this.to<=o.to) return o
        if(this.from<=o.from&&o.from<=this.to) return range(this.from,o.to)
        if(this.from<=o.to&&o.to<=this.to) return range(o.from,this.to)
        return or(this,o)
      // case Not:
      case Or: return or(cons(o,this.sel))
      // case And:
    }
    return or(this,o)
  }
  exclude(o) {
    switch(o.constructor) {
      case None: return this
      case Any: return none
      case Is: 
      case Cases:
        if(this.match(o.sel)) break
        else return this
      case OneOf: 
      case noneOf:return this.exclude(o.decomp())
      case Not: return this.exclude(o.neg())
      case Range:
      default:break
    }
    return and(this,not(o))
  }
  simpl() {
    clog("Range::simpl",this.expect)
    if(this.from===this.to) return Just(is(this.from))
    //CHECK:small ranges can use oneOf? how small?
    if(this.from>this.to) return Just(none)
    return Nothing()
  }
}
const range=(...oo)=>new Range(...oo)

class ListSel extends Selector {
  constructor(...oo) {super(oo)}
  head() {return or(...this.sel.head())}
  tail() {return or(...this.sel.tail())}
  init() {return or(...this.sel.init())}
  last() {return or(...this.sel.last())}
  cons(o) {return or(...this.sel.cons(o))}
  get length() {return this.sel.length}
  elem(o) {
    for(var i of this.sel)
      if(o.same(i)) return true
    return false
  }
  same(o) {
    if(!(o.constructor===Or&&this.sel.length===o.sel.length)) return false
    const d0=diff(this.sel)(o.sel)
    if(d0.length) return false
    const d1=diff(o.sel)(this.sel)
    return !d0.length
  }
}

class Or extends ListSel {
  get expect() {return this.msg||"match "+this.sel.map(expect).join(" or ")}
  match(o) {return foldr(f=>a=>a||f(o),false,this.sel)}
  neg() {return and(...this.sel.map(neg))}
  union(o) {
    return o.constructor===Or?
      or(this.sel.concat(o.sel)):
      this.sel.foldr(union)(o)
  }
  simpl() {
    clog("Or::simpl",this.expect)
    //empty list => none
    if(!this.sel.length) return mxlog("->",o=>o+"")(Just(none))
    //single element
    if(this.sel.length===1) return mxlog("->",o=>o+"")(Just(head(this.sel)))
    //remove all none's
    var oo=this.sel.filter(o=>o.constructor!==None)
    if(oo.length!==this.sel.length) return mxlog("->",o=>o+"")(Just(or(...oo)))
    //remove duplicates
    const _unique=o=>oo=>or(...oo).elem(o)?unique(oo):cons(o,unique(oo))
    const unique=oo=>oo.length?_unique(head(oo))(tail(oo)):[]
    var u=unique(this.sel)
    if(u.length!==this.sel.length) return mxlog("->",o=>o+"")(Just(or(...u)))
    //all `Is`?
    if (foldr(a=>b=>b&&a.constructor===Is)(true)(this.sel))
      return mxlog("->",o=>o+"")(Just(oneOf(this.sel.foldr(a=>b=>b+a.sel)(""))))
    //simpl members
    var s=this.sel.map(simpl)
    if(s.filter(isJust).length)
      return mxlog("->",o=>o+"")(Just(or(...zipWith(a=>b=>isJust(b)?fromJust(b):a)(this.sel,s))))
    
    //TODO:join oneOf's
    //fold union
    var fu=this.sel.foldr1(union)
    if(fu.constructor!==Or) return mxlog("->",o=>o+"")(Just(fu))
    if(!this.same(fu)) return mxlog("->",o=>o+"")(Just(fu))
    return log("->Nothing",Nothing())
  }
}
const or=(...oo)=>new Or(...oo)

class And extends ListSel {
  get expect() {return this.msg||"match "+this.sel.map(expect).join(" and ")}
  match(o) {return foldr(f=>a=>a&&f(o),true,this.sel)}
  neg() {return or(...this.sel.map(neg))}
  union(o) {
    switch(o.constructor) {
      case None: return this
      case Any: return any
      default: return or(this,o)
    }
  }
  simpl() {
    clog("And::simpl",this.expect)
    //empty list => none
    if(!this.sel.length) return Just(none)
    //single element
    if(this.sel.length===1) return Just(head(this.sel))
    //remove all any's
    var oo=this.sel.filter(o=>o.constructor!==Any)
    if(oo.length!==this.sel.length) return Just(and(...oo))
    //remove duplicates
    const _unique=o=>oo=>and(...oo).elem(o)?unique(oo):cons(o,unique(oo))
    const unique=oo=>oo.length?_unique(head(oo))(tail(oo)):[]
    var u=unique(this.sel)
    if(u.length!==this.sel.length) return Just(and(...u))
    //all `Is`?
    // if (foldr(a=>b=>b&&a.constructor===Is)(true)(this.sel))
    //   return Just(oneOf(this.sel.foldr(a=>b=>b+a.sel)("")))
    return Nothing()
  }
}
const and=(...oo)=>new And(...oo)

const Expect=class Expect extends CharParser {
  constructor(m,o) {
    super()
    this.target=o
    this.msg=m
  }
  get expect() {return this.msg}
  get sel() {return this.target.sel}
  get length() {return this.target.length}
  match(o) {
    // clog("Expect: match indirection")
    return this.target.match(o)}
  neg() {return this.target.neg()}
  union(o) {return this.target.union(o)}
  exclude(o) {return this.target.exlude(o)}
  simpl() {return this.target.simpl()}
  // valueOf() {return this.target}
}

const digit=range('0','9',"digit")
const lower=range('a','z',"lowercase letter")
const upper=range('A','Z',"uppercase letter")

const letter=new Expect("letter",or(lower,upper))
const alphaNum=new Expect("alphanumeric",or(letter,digit))
const hex=new Expect("hex digit",or(digit,range('a','f'),range('A','F')))
const oct=new Expect("octal digit",range('0','7'))
const space=new Expect("space",is(' '))
const tab=new Expect("tab",is('\t'))
const nl=new Expect("newline",is('\n'))
const cr=new Expect("carriage return",is('\r'))
const blank=new Expect("whitespace",or(space,tab))

class EOF extends CharParser {
  get expect() {return "end of file"}
  get canFail() {return true}
  get consumes() {return false}
  match(o) {return typeof o==="undefined"}
}
const eof=new EOF()

class EOL extends CharParser {
  get expect() {return "end line or file"}
  get canFail() {return true}
  get consumes() {return false}
  match(o) {return or(nl,eof)(o)}
}
const eol=new EOL()

exports.isAnyChar=any
exports.isNone=neg(any)
exports.isChar=is
exports.anyCase=cases
exports.isOneOf=oneOf
exports.isNoneOf=noneOf
exports.inRange=range
exports.isDigit=digit
exports.isLower=lower
exports.isUpper=upper
exports.isLetter=letter
exports.isAlphaNum=alphaNum
exports.isHexDigit=hex
exports.isOctDigit=oct
exports.isSpace=space
exports.isTab=tab
exports.is_nl=nl
exports.is_cr=cr
exports.isBlank=blank
exports.isEof=eof
exports.isEol=eol
exports.expect=expect
exports.isMatch=or

// clog(range('0','8').union(digit))
// clog(range('a','z').union(oneOf("kwy1")))
// clog(or(range('a','z'),oneOf("kwy")).simpl())
// const o=or(digit,noneOf("a9"),or())
// clog(o.simplify().value)