"use strict";

const chkOf=m=>p=>(p.expect=m,p)

//parser primitves
const isChar=c=>chkOf("character `"+c+"`")(o=>c==o)
const isOneOf=cs=>chkOf("one of `"+cs+"`")(o=>cs.indexOf(o)>-1)
const isNoneOf=cs=>chkOf("none of `"+cs+"`")(o=>cs.indexOf(o)==-1)
const inRange=(a,z)=>chkOf("character in range from `"+a+"` to `"+z+"´")(o=>a<=o&&o<=z)

const isDigit=chkOf("digit")(inRange('0','9'))
const isLower=chkOf("lower letter")(inRange('a','z'))
const isUpper=chkOf("upper letter")(inRange('A','Z'))
const isLetter=chkOf("letter")(o=>isLower(o)||isUpper(o))
const isEof=chkOf("eof")(o=>typeof i==="undefined")

exports.isChar=isChar
exports.isOneOf=isOneOf
exports.isNoneOf=isNoneOf
exports.inRange=inRange
exports.isDigit=isDigit
exports.isLower=isLower
exports.isUpper=isUpper
exports.isLetter=isLetter
exports.isAlphaNum=chkOf("alpha numeric")(o=>isLetter(o)||isDigit(o))
exports.isHexDigit=chkOf("hex digit")(o=>isDigit(o)||inRange('a','f')(o)||inRange('A','F')(o))
exports.isOctDigit=chkOf("octal digit")(inRange('0','7'))
exports.isSpace=chkOf("space")(isChar(' '))
exports.isTab=chkOf("tab")(isChar('\t'))
exports.is_nl=chkOf("newline")(isChar('\n'))
exports.is_cr=chkOf("carriage return")(isChar('\r'))
exports.isBlank=chkOf("white space")(o=>exports.isSpace(o)||exports.isTab(o))
exports.isEof=isEof
