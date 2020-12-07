#!/usr/bin/env node
/* PaCo JSON parser
 * RFC https://tools.ietf.org/html/rfc7159
 * just do a parse validation, no AST generated
 */

const { isLeft, fromLeft, fromRight } = require("funjs");
const paco=require("../../paco");
const fs=require("fs");
const { userInfo } = require("os");

//  const unescaped=
//   paco.range("\u{20}","\u{21}")
//   .or(paco.range("\u{23}","\u{5B}"))
//   .or(paco.range("\u{5D}","\u{10FFFF}"))

//2. JSON Grammar

// const ws = paco.many(paco.skip(paco.oneOf("\u{20}\u{09}\u{0A}\u{0D}")))
const ws = paco.many(paco.skip(paco.oneOf(" \t\n\r")))
const begin_array     = ws.then(paco.char("[")).then(ws)// [ left square bracket
const begin_object    = ws.then(paco.char("{")).then(ws)// { left curly bracket
const end_array       = ws.then(paco.char("]")).then(ws)// ] right square bracket
const end_object      = ws.then(paco.char("}")).then(ws)// } right curly bracket
const name_separator  = ws.then(paco.char(":")).then(ws)// : colon
const value_separator = ws.then(paco.char(",")).then(ws)// , comma

//7. Strings
// const quotation_mark=paco.char("\u{22}")
// const escape=paco.char("\u{5C}")
// const char = unescaped.or(escape.then(paco.oneOf("\u{22}\u{5C}\u{2F}\u{62}\u{66}\u{6E}\u{72}\u{74}\u{75}")))
// char.expect="character"
// const string=paco.skip(quotation_mark).then(paco.many(char)).skip(quotation_mark).join().as(o=>o[0])
const string
  =paco.skip(paco.char('"'))
  .then( paco.many(paco.char('\\')
  .then(paco.anyChar).or(paco.noneOf('"'))) )
  .skip(paco.char('"')).join("")
string.expect="quoted string"
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
function array() {
  return new paco.Meta(
    ex=>io=>
    paco.skip(begin_array)
    .then(paco.optional(paco.sepBy(value,value_separator)))
    .skip(end_array).as(o=>[o])(ex)(io)
  ).failMsg("Array")
}
//4. Objects
const member = string.skip(name_separator).then(value).as(o=>[o])
function object() {
  return new paco.Meta(
    ex=>io=>paco.skip(begin_object)
    .then(paco.optional(member.then(paco.many( paco.skip(value_separator).then(member) ))))
    .skip(end_object).as(o=>{
      var obj={}
      o.map(o=>obj[o[0]]=o[1])
      return obj
    })(ex)(io)
  ).failMsg("Object")
}

//2. Grammar
const JSON_text = paco.skip(ws).then(value).skip(ws)

const json=s=>{
  const r=paco.res("JSON>")(JSON_text.parse(s))
  if(isLeft(r)) console.log(fromLeft(r))
  else return fromRight(r)[0]
}

const parseFile=fn=>{return json(fs.readFileSync(fn,'utf8'))}

if(process.argv[2]){
  console.log(parseFile(process.argv[2]))
}

console.log("#parsers:",paco.maps)
const start=new Date()
console.log(parseFile("/home/azevedo/code/nodes/paco/examples/json-paco-ast/ex1.json"))
const end=new Date()
console.log((end-start)/1000,"s")
console.log("#parsers:",paco.maps)

