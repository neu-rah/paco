"use strict";

//parser primitves
const inRange=(a,z)=>o=>a<=o&&o<=z
const isDigit=inRange('0','9')
const isLowerCase=inRange('a','z')
const isUpperCase=inRange('A','Z')
const isLetter=o=>isLowerCase(o)||isUpperCase(o)

exports.isChar=c=>o=>c==o
exports.inRange=inRange
exports.isDigit=isDigit
exports.isLowerCase=isLowerCase
exports.isUpperCase=isUpperCase
exports.isLetter=isLetter
exports.isAlphaNum=o=>isLetter(o)||isDigit(o)
exports.isDigit.expect="digit"