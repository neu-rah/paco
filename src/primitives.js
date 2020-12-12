"use strict";

const {log,clog,xlog,debugging}=require("./debug.js")
const { patchPrimitives,map,foldr } = require("rsite-funjs");

patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
  Object().__proto__,
)

const chkOf=e=>(f,canFail,consumes)=>{
  f.expect=e
  f.canFail=typeof canFail==="undefined"?true:canFail
  f.consumes=typeof consumes==="undefined"?true:consumes
  f.minus=o=>chkOf(f.expect+" minus "+o.expect)(p=>any(p)&&not(o)(p))
  return f
}

const neg=f=>(...o)=>!f(o)

const expect=o=>o.expect

const any=chkOf("any character")(o=>typeof o!=="undefined",false)
const is=c=>chkOf("character '"+c+"'")(o=>o===c)
const cases=c=>chkOf("character '"+c+"'")(o=>o.toLowerCase()===c.toLowerCase())
const oneOf=s=>chkOf("one of \""+s+"\"")(o=>s.indexOf(o)!=-1)
const noneOf=s=>not(oneOf(s))
const range=(a,z)=>chkOf("range '"+a+"' to '"+z+"'")(o=>a<=o&&o<=z)
const not=f=>chkOf("not "+f.expect)(o=>!f(o))
const match=
  (...oo)=>chkOf("match "+map(expect)(oo).join(" or "))
  (o=>foldr(f=>a=>a||f(o),false,oo))

const digit=chkOf("digit")(range('0','9'))
const lower=chkOf("lowercase letter")(range('a','z'))
const upper=chkOf("uppercase letter")(range('A','Z'))
const letter=chkOf("letter")(o=>lower(o)||upper(o))
const alphaNum=chkOf("alphanumeric")(o=>letter(o)||digit(o))
const hex=chkOf("hex digit")(match(digit,range('a','f'),range('A','F')))
const oct=chkOf("octal digit")(range('0','7'))
const space=chkOf("space")(is(' '))
const tab=chkOf("tab")(is('\t'))
const nl=chkOf("newline")(is('\n'))
const cr=chkOf("carriage return")(is('\r'))
const blank=chkOf("whitespace")(match(space,tab))
const eof=chkOf("end of file")(o=>typeof o==="undefined",true,false)
const eol=chkOf("end of line or end of file")(o=>nl(o)||eof(o),true,false)

// const m=match(range('a','z'),range('A','Z'),range('0','9'),is('#'),oneOf(".$"),noneOf("abcd"))


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
