#!/usr/bin/env node
/* PaCo JSON parser
 * RFC https://tools.ietf.org/html/rfc7159
 * parse validate and build json object
 */

const fs=require("fs");
const { isLeft, fromLeft, fromRight } = require("rsite-funjs");
const paco=require("../../paco");

 const unescaped=
  paco.range("\u{20}","\u{21}")
  .or(paco.range("\u{23}","\u{5B}"))
  .or(paco.range("\u{5D}","\u{10FFFF}"))

//2. JSON Grammar

const ws = paco.skip(paco.many(paco.oneOf(" \t\n\r")))
// const ws = paco.many(paco.skip(paco.oneOf(" \t\n\r")))
const begin_array     = ws.then(paco.char("\u{5B}")).then(ws)// [ left square bracket
const begin_object    = ws.then(paco.char("\u{7B}")).then(ws)// { left curly bracket
const end_array       = ws.then(paco.char("\u{5D}")).then(ws)// ] right square bracket
const end_object      = ws.then(paco.char("\u{7D}")).then(ws)// } right curly bracket
const name_separator  = ws.then(paco.char("\u{3A}")).then(ws)// : colon
const value_separator = ws.then(paco.char("\u{2C}")).then(ws)// , comma

//7. Strings
const quotation_mark=paco.char("\u{22}")
const escape=paco.char("\u{5C}")
const char = unescaped.or(escape.then(paco.oneOf("\u{22}\u{5C}\u{2F}\u{62}\u{66}\u{6E}\u{72}\u{74}\u{75}")))
char.expect="character"
const string=
  paco.skip(quotation_mark)
  .then(paco.many(char))
  .skip(quotation_mark)
  .join().as(o=>o[0])

//this string literal parse is faster, 
// however it does not validate characters, 
// and just check \" escape, leaving all other escapping as is
// const string
//   =paco.skip(paco.char('"'))
//   .then(paco.many(paco.char('\\')
//   .then(paco.anyChar).or(paco.noneOf('"'))) )
//   .skip(paco.char('"')).join("")
//   .failMsg("quoted string")
//6. Numbers
const zero=paco.char("\u{30}")
const plus=paco.char("\u{2B}")
const minus=paco.char("\u{2D}")
const digit1_9=paco.range('1','9')
const int=zero.notFollowedBy(paco.digit).or(digit1_9.then(paco.digits).join())
const decimal_point=paco.char("\u{2E}")
const frac=decimal_point.then(paco.many1(paco.digit)).join()
const e=paco.oneOf("\u{65}\u{45}")
const exp=e.then(paco.optional(minus.or(plus))).then(paco.many1(paco.digit))
const number
  =paco.optional(minus)
  .then(int)
  .then(paco.optional(frac))
  .then(paco.optional(exp))
  .as(o=>{
    const neg=o[0]==='-'
    return o.length===(neg?2:1)?
      parseInt(o.join("")):
      parseFloat(o.join(""))
  })
number.expect="number"
// 3. Values
class Arr extends paco.Parser {
  get name() {return "Array"}
  run(io) {
    return arrDef.run(io)
  }
}

class Obj extends paco.Parser {
  get name() {return "Object"}
  run(io) {return objDef.run(io)}
}

const _null=paco.string("null").as(_=>null)
const _true=paco.string("true").as(_=>true)
const _false=paco.string("false").as(_=>false)
const value=
    _false
    .or(_true)
    .or(_null)
    .or(object())
    .or(array())
    .or(number)
    .or(string)
value.expect="value"

//5. Arrays
function array() {return new Arr()}

const arrDef=paco.skip(begin_array)
  .then(paco.optional(paco.sepBy(value,value_separator)))
  .skip(end_array)
  .as(o=>[o]).optimize()

//4. Objects
const member = string.skip(name_separator).then(value).as(o=>[o])

const objDef=paco.skip(begin_object)
  .then(paco.optional(member.then(paco.many( paco.skip(value_separator).then(member) ))))
  .skip(end_object)
  .as(o=>{
    var obj={}
    o.map(o=>obj[o[0]]=o[1])
    return obj
  }).optimize()

function object() {return new Obj()}

//2. Grammar
const JSON_text = ws.then(value).then(ws).failMsg("JSON parse")

const json=s=>{
  const r=paco.res("JSON>")(JSON_text.parse(s))
  if(isLeft(r)) console.log(fromLeft(r))
  else return fromRight(r)
}

const parseFile=fn=>{return json(fs.readFileSync(fn,'utf8'))}

if(process.argv[2]){
  const start=new Date()
  console.log(parseFile(process.argv[2]))
  const end=new Date()
  console.log((end-start)/1000,"s")
}

// {
//   console.log("paco JSON parse")
//   const start=new Date()
//   console.log(parseFile("/home/azevedo/code/nodes/paquito/examples/json-paco-ast/ex4.json"))
//   const end=new Date()
//   console.log((end-start)/1000,"s")
// }

