/* PaCo JSON parser
 * RFC https://tools.ietf.org/html/rfc7159
 * just do a parse validation, no AST generated
 */

// const {
//   anyChar,char,oneOf,noneOf,range,satisfy,none,skip,
//   digit,lower,upper,letter,alphaNum,hexDigit,octDigit,
//   space,tab,nl,cr,blank,
//   digits,spaces,blanks,spaces1,blanks1,eof,
//   string,regex,many,many1,manyTill,optional,
//   choice,count,between,option,optionMaybe,sepBy,sepBy1,endBy,endBy1,
//   parse,res,parserOf
// }=require("paco");

const paco=require("../../paco");

const unescaped=
  paco.range("\u{20}","\u{21}")
  .or(paco.range("\u{23}","\u{5B}"))
  .or(paco.range("\u{5D}","\u{10FFFF}"))

//2. JSON Grammar

const ws = paco.many(paco.oneOf("\u{20}\u{09}\u{0A}\u{0D}"))
const begin_array     = paco.skip(ws).then(paco.char("\u{5B}")).skip(ws)// [ left square bracket
const begin_object    = paco.skip(ws).then(paco.char("\u{7B}")).skip(ws)// { left curly bracket
const end_array       = paco.skip(ws).then(paco.char("\u{5D}")).skip(ws)// ] right square bracket
const end_object      = paco.skip(ws).then(paco.char("\u{7D}")).skip(ws)// } right curly bracket
const name_separator  = paco.skip(ws).then(paco.char("\u{3A}")).skip(ws)// : colon
const value_separator = paco.skip(ws).then(paco.char("\u{2C}")).skip(ws)// , comma

//7. Strings
const quotation_mark=paco.char("\u{22}")
const escape=paco.char("\u{5C}")
const char = unescaped.or(escape.then(paco.oneOf("\u{22}\u{5C}\u{2F}\u{62}\u{66}\u{6E}\u{72}\u{74}\u{75}")))
const string=quotation_mark.then(paco.many(char)).then(quotation_mark).join()
//6. Numbers
const zero=paco.char("\u{30}")
const plus=paco.char("\u{2B}")
const minus=paco.char("\u{2D}")
const digit1_9=paco.range('1','9')
const int=zero.notFollowedBy(paco.digit).or(digit1_9.then(paco.digits).join())
const decimal_point=paco.char("\u{2E}")
const frac=decimal_point.then(paco.many1(paco.digit))
const e=paco.oneOf("\u{65}\u{45}")
const exp=e.then(paco.optional(minus.or(plus))).then(paco.many1(paco.digit))
const number=paco.optional(minus).then(int).then(paco.optional(frac)).then(paco.optional(exp)).join()
// 3. Values
const _null=paco.string("null")
const _true=paco.string("true")
const _false=paco.string("false")
const value
  =_false
  .or(_true)
  .or(_null)
  .or(object())
  .or(array())
  .or(number)
  .or(string)
//5. Arrays
const member = string.then(name_separator).then(value)
function array() {
  return paco.parserOf("Array")
    (ex=>io=>begin_array.then(paco.optional(paco.sepBy(value,value_separator))).then(end_array)(ex)(io))
}
//4. Objects
function object() {
  return paco.parserOf("Object")
    (ex=>io=>begin_object.then(paco.optional(paco.sepBy(member,value_separator.then(member)))).then(end_object)(ex)(io))
}
paco.parserOf("Object")(object)

//2. Grammar
const JSON_text = paco.skip(ws).then(value).skip(ws)

console.log(paco.res("")(JSON_text.parse('{"o":[123]}')))