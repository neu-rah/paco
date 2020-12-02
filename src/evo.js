"use strict";

const { patchPrimitives,map,foldr,curry } = require("funjs");
patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
)
const is=curry((c,o)=>o===c)
const not=curry((c,o)=>o!==c)
const le=curry((c,o)=>o<=c)
const ge=curry((c,o)=>o>=c)

is.not=not
not.not=is
le.not=ge
ge.not=le

not=o=>o.not

const range=curry((a,z)=>o=>a<=o&&o<=z)
const exclr=curry((a,z)=>o=>a>o||o>z)
range.not=exclr
exclr.not=range

const match=curry((oo,o)=>foldr(f=>f(o),false,oo))
match.not=map(not)
