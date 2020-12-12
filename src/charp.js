"use strict";

//this is slower than primitives.js
// same file 0.85 -> 1.15

const {log,clog,xlog,debugging}=require("./debug.js")
const { patchPrimitives,map,foldr } = require("rsite-funjs");

patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
  Object().__proto__,
)

const neg=o=>o.neg()
const expect=o=>o.expect

class CharParser extends Function {
  constructor() {
    super('...args', 'return this.__self__.match(...args)')
    var self=this.bind(this)
    this.__self__=self
    return self
  }
  neg() {return not(this)}
}

class Any extends CharParser {
  get expect() {return "any character"}
  get canFail() {return true}
  get consumes() {return true}
  match(o) {return true}
  neg() {return none}
  exclude(o) {return o.neg()}
}
const any=new Any()

class None extends CharParser {
  get expect() {return "no character"}
  get canFail() {return true}
  get consumes() {return false}
  match(o) {return false}
  neg() {return any}
  exclude(o) {return o}
}
const none=new None()

class Selector extends CharParser {
  constructor(sel,msg){
    super()
    this.sel=sel
    this.msg=msg
  }
  get expect() {return this.msg}
}

class Is extends Selector {
  get expect() {return "character '"+this.sel+"'"}
  match(o) {return this.sel===o}
  exclude(o) {return o(this.sel)?none:this}
}
const is=c=>new Is(c)

class Cases extends Selector {
  get expect() {return "any case of '"+this.sel+"'"}
  match(o) {return o.toLowerCase()===c.toLowerCase()}
  exclude(o) {
    if(o(this.sel.toLowerCase())) return is(this.sel.toUpperCase()).exclude(o)
    if(o(this.sel.toUpperCase())) return is(this.sel.toLowerCase()).exclude(o)
    return this
  }
}
const cases=c=>new Cases(c)

class OneOf extends Selector {
  get expect() {return "one of \""+this.sel+"\""}
  match(o) {return this.sel.indexOf(o)!=-1}
  neg() {return noneOf(this.sel)}
  exclude(o) {return or(...this.sel.split("").map(x=>is(x).exclude(o)))}
  decomp() {return or(...this.sel.split("").map(x=>is(x)))}
}
const oneOf=s=>new OneOf(s)

class NoneOf extends Selector {
  get expect() {return "none of \""+this.sel+"\""}
  match(o) {return this.sel.indexOf(o)===-1}
  neg() {return oneOf(this.sel)}
  exclude(o) {return and(...this.sel.split("").map(x=>not(is(x)).exclude(o)))}
  decomp() {return and(...this.sel.split("").map(x=>not(is(x))))}
}
const noneOf=s=>new NoneOf(s)

class Not extends Selector {
  get expect() {return "not "+this.sel.expect}
  match(o) {return !this.sel.match(o)}
  neg() {return this.sel}
  exclude(o) {return not(this.sel.exclude(o))}
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
  match(o) {return this.from<=o&&o<=this.to}
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
}
const range=(...oo)=>new Range(...oo)

class ListSel extends Selector {constructor(...oo) {super(oo)}}

class Or extends ListSel {
  get expect() {return this.msg||"match "+this.sel.map(expect).join(" or ")}
  match(o) {return foldr(f=>a=>a||f(o),false,this.sel)}
  neg() {return and(...this.sel.map(neg))}
}
const or=(...oo)=>new Or(...oo)

class And extends ListSel {
  get expect() {return this.msg||"match "+this.sel.map(expect).join(" and ")}
  match(o) {return foldr(f=>a=>a&&f(o),false,this.sel)}
  neg() {return or(...this.sel.map(neg))}
}
const and=(...oo)=>new And(...oo)

const Expect=class Expect extends CharParser {
  constructor(m,o) {
    super()
    this.target=o
    this.msg=m
  }
  get expect() {return this.msg}
  match(o) {return this.target.match(o)}
  neg() {return this.target.neg()}
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

if(!exports) var exports={}

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
