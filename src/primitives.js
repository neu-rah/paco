"use strict";

const {log,clog,xlog,debuging}=require("./debug.js")
const { patchPrimitives,map,foldr,foldr1 } = require("funjs");

patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
)

const chkOf=m=>p=>d=>(
  p.expect=m,
  p.domain=d,
  p.exclude=o=>p.domain.exclude(o),
  p
)

const prev=o=>String.fromCharCode(o.charCodeAt(0)-1)
const next=o=>String.fromCharCode(o.charCodeAt(0)+1)

const not=o=>o.not
const exclude=o=>o.exclude

class Match {
  has(c) {return this.self()(c)}
  hasNot(c) {return !this.has(c)}
}

class None extends Match {
  not() {return anyChar}
  exclude(_) {return isNone}
}

class Any extends Match {
  self() {return isAnyChar}
  not() {return isNone}
  exclude(e) {
    const o=e.domain
    switch(o.constructor) {
      case Eof:
      case NotEof:
      case None: return isAnyChar
      case Any: return isNone
      case Point:return isNoneOf(o.point)
      case Range: return notInRange(o.from,o.to)
      case NotRange: return inRange(o.from,o.to)
      case Less: return isGreater(next(o.point))
      case Greater: return isLess(prev(o.point))
      case Set: {return o.split().foldr(f=>a=>f.exclude(a))(e)}
      case Unset: return  foldr(f=>a=>a.exclude(f),this,o.points)
      default: throw new Error("unknown character parser domain")
    }
  }
}
class Less extends Match {
  constructor(o) {super();this.point=o}
  self() {return isLess(this.point)}
  not() {return isGreater(next(this.point))}
  exclude(e) {
    const o=e.domain
    switch(o.constructor) {
      case Eof:
      case NotEof:
      case None: return isLess(o.point)
      case Any: return isNone
      case Point:
        return o.point<this.point?
          inRanges(isLess(prev(i.point)),inRange(next(i.point),this.point)):
          isLess(this.point)
      case Range: {
        if(o.from>this.point) return isLess(this.point)
        if(o.to>=this.point) return isLess(prev(o.from))
        return inRanges(isLess(prev(o.from)),inRange(next(o.to),this.point))
      }
      case NotRange:
        if(this.point<=o.from) return isNone
        if(this.point<o.to) return o.not()
        return inRange(next(o.to),this.point)
      case Less: return isLess(this.point<o.point?this.point:o.point)
      case Greater: return this.point<o.point?isLess(this.point):isLess(o.point)
      case Set: return foldr(f=>a=>a.exclude(f),this,o.points)
      case Unset: return  foldr(f=>a=>a.exclude(f),this,o.points)
      default: throw new Error("unknown character parser domain")
    }
  }
}

class Greater extends Match {
  constructor(o){super();this.point=o}
  self() {return isGreater(this.point)}
  exclude(e) {
    const o=e.domain
    switch(o.constructor) {
      case Eof:
      case NotEof:
      case None: return isGreater(o.point)
      case Any: return isNone
      case Point:
        return o.point>this.point?
          inRanges(inRange(this.point,prev(i.point)),isGreater(next(i.point))):
          isGreater(this.point)
      case Range: {
        if(o.to<this.point) return isGreater(this.point)
        if(o.from<=this.point) return isGreater(prev(o.to))
        return inRanges(isGreater(next(o.to)),inRange(this.point,prev(o.from)))
      }
      case NotRange:
        if(this.point>=o.to) return isNone
        if(this.point<o.from) return o.not()
        return inRange(this.point,prev(o.to))
      case Less: return isGreater(this.point>o.point?this.point:o.point)
      case Greater: return this.point<o.point?inRange(this.point,prev(o.from)):isNone
      case Set: return foldr(f=>a=>a.exclude(f),this,o.points)
      case Unset: return  foldr(f=>a=>a.exclude(f),this,o.points)
      default: throw new Error("unknown character parser domain")
    }
  }
}

class Range extends Match {
  constructor(a,z) {
    super()
    this.from=a
    this.to=z
  }
  self() {return inRange(this.from,this.to)}
  not() {return notInRange(this.from,this.to)}
  exclude(e) {
    const o=e.domain
    switch(o.constructor) {
      case Eof:
      case NotEof:
      case None: return inRange(this.from,this.to)
      case Any: return isAnyChar
      case Point:
        if(this.hasNot(p.point)) return this.self()
        return inRanges(inRange(this.from,prev(o.point)),(inRange(next(o.point),this.to)))
      case Range: {
        if(o.from>this.to) return inRange(this.from,this.to)
        if(o.from<=this.to&&o.from>=this.from) return inRange(this.from,prev(o.from))
        if(o.to>=this.from&&o.to<=this.to) return inRange(next(o.from),this.from)
        return isNone
      }
      case NotRange:
        if(o.from<this.from&&o.to>this.to) return inRange(this.from,this.to)
        if(o.from>=this.from&&o.from<=this.to) return inRange(next(o.from),this.to)
        if(o.to>=this.from&&o.to<=this.to) return inRange(this.from,prev(this.from))
      case Less: return isGreater(this.point>o.point?this.point:o.point)
      case Greater: return this.point<o.point?inRange(this.point,prev(o.from)):isNone
      case Set: return foldr(f=>a=>a.exclude(f),this,o.points)
      case Unset: return  foldr(f=>a=>a.exclude(f),this,o.points)
      default: throw new Error("unknown character parser domain")
    }
  }
}

class NotRange extends Match {
  constructor(a,z) {
    super()
    this.from=a
    this.to=z
  }
  self() {return notInRange(this.from,this.to)}
  not() {return inRange(this.from,this.to)}
  exclude(e) {
    const o=e.domain
    switch(o.constructor) {
      case Eof:
      case NotEof:
      case None: return isAnyChar 
      case Any: return isNone
      case Point:
        if(this.from>o||o>this.to) return inRange(this.from,this.to)
        return inRanges(inRange(this.from,prev(o.point)),(inRange(next(o.point),this.to)))
      case Range: {
        if (o.from>this.from&&oto<this.to) return NotRange(this.from,this.to)
        if(o.to>=this.to&&o.from<=this.from) return isNone
        if(o.from<=this.from) return new NotRange(o.from,this.to)
        if(o.to>=this.to) return new NotRange(this.from,o.to)
      }
      case Set: return foldr(f=>a=>a.exclude(f),this,o.points)
      case Unset: return  foldr(f=>a=>a.exclude(f),this,o.points)
      default: throw new Error("unknown character parser domain")
    }
  }
}

class Ranges extends Match {
  constructor(oo) {super();this.ranges=oo}
  self() {return inRanges(this.ranges)}
  not() {return inRanges(map(not,this.ranges))}
  exclude(o) {return inRanges(map(p=>p.exclude(o),this.ranges))}
}
class Point extends Match {
  constructor(o){super();this.point=o}
  self() {return char(this.point)}
  not() {return isNoneOf(this.point)}
  exclude(e) {
    const o=e.domain
    switch(o.constructor) {
      case Eof:
      case NotEof:
      case None: return isChar(this.point)
      case Any: return isNone
      case Point:return this.point===o.point?isNone:isChar(this.point)
      case Range: return o.has(this.point)?isNone:isChar(this.point)
      case NotRange: return o.has(this.point)?isNone:isChar(this.point)
      case Less: return o.has(this.point)?isNone:isChar(this.point)
      case Greater: return o.has(this.point)?isNone:isChar(this.point)
      case Set: return o.split().foldr(f=>a=>a.exclude(f))(this)
      case Unset: return  foldr(f=>a=>a.exclude(f),this,o.points)
      default: throw new Error("unknown character parser domain")
    }
  }
}

class Set extends Match {
  constructor(o) {super();this.points=o}
  self() {return oneOf(o)}
  not() {return noneOf(o)}
  split() {return map(isChar)(this.points.split(""))}
  exclude(e) {
    const o=e.domain
    switch(o.constructor) {
      case Eof:
      case NotEof:
      case None: return this.self()
      case Any: return isNone
      case Point:return inRanges((map(f=>f.exclude(o))(this.split())))
      case Range: return map(f=>f.exclude(o))(this.points)
      case NotRange: return map(f=>f.exclude(o))(this.points)
      case Less: return map(f=>f.exclude(o))(this.points)
      case Greater: return map(f=>f.exclude(o))(this.points)
      case Set: return  map(f=>f.exclude(o))(this.points)
      case Unset: return  map(f=>f.exclude(o))(this.points)
      default: throw new Error("unknown character parser domain")
    }
  }
}

class Unset extends Match {
  constructor(o) {super();this.points=o}
  self() {return noneOf(o)}
  not() {return oneOf(o)}
  split() {return map(noneOf)(this.points.split(""))}
  exclude(e) {
    const o=e.domain
    switch(o.constructor) {
      case Eof:
      case NotEof:
      case None: return this.self()
      case Any: return isNone
      case Point:return map(f=>f.exclude(o))(this.points)
      case Range: return map(f=>f.exclude(o))(this.points)
      case NotRange: return map(f=>f.exclude(o))(this.points)
      case Less: return map(f=>f.exclude(o))(this.points)
      case Greater: return map(f=>f.exclude(o))(this.points)
      case Set: return map(f=>f.exclude(o))(this.points)
      case Unset: return  map(f=>f.exclude(o))(this.points)
      default: throw new Error("unknown character parser domain")
    }
  }
}

class Eof extends Match {
  self() {return isEof}
  not() {return isNotEof}
  exclude(e) {
    const o=e.domain
    switch(o.constructor) {
      case None:
      case Any:
      case Point:
      case Range:
      case NotRange:
      case Less:
      case Greater:
      case Set:
      case Unset:
      case NotEof:
        return this.self()
      case Eof:return isNotEof;
      default: throw new Error("unknown character parser domain")
    }
  }
}

class NotEof extends Match {
  self() {return isNotEof}
  not() {return isEof}
  exclude(e) {
    const o=e.domain
    switch(o.constructor) {
      case None:
      case Any:
      case Point:
      case Range:
      case NotRange:
      case Less:
      case Greater:
      case Set:
      case Unset:
      case Eof:
        return this.self()
      case NotEof:
        return isEof;
      default: throw new Error("unknown character parser domain")
    }
  }
}

//parser primitives ------------------------------------------------------------------------------
const isNone=
  chkOf("no character")
  (_=>false)
  (new None())

const isAnyChar=
  chkOf("any character")
  (o=>typeof o!=="undefined")
  (new Any())

const isChar=
  c=>chkOf("character `"+c+"`")
  (o=>c==o)
  (new Point(c))

const isOneOf=
  cs=>chkOf("one of `"+cs+"`")
  (o=>cs.indexOf(o)>-1)
  (new Set(cs))

const isNoneOf=
  cs=>chkOf("isNone of `"+cs+"`")
  (o=>typeof o!=="undefined"&&cs.indexOf(o)==-1)
  (new Unset(cs))

const inRange=(a,z)=>
  chkOf("character in range from `"+a+"` to `"+z+"´")
    (o=>a<=o&&o<=z)
    (new Range(a,z))

const notInRange=(a,z)=>
  chkOf("character NOT in range `"+a+"´ to `"+z+"´")
  (o=>!inRange(a,z)(o))
  (new NotRange(a,z))

  const isLess=o=>
  chkOf("character `"+o+"´ or previous")
  (c=>c<=o)
  (new Less(o))

const isGreater=o=>
  chkOf("character `"+o+"´ or next")
  (c=>c>=o)
  (new Greater(o))


const inRanges=(...oo)=>
  chkOf("character in ranges")
    (o=>foldr1(a=>b=>a||b,map(f=>f(o),oo)))
    (new Ranges(oo))

const isDigit=
  chkOf("digit")
  (inRange('0','9'))
  (new Range('0','9'))

const isLower=
  chkOf("lower letter")
  (inRange('a','z'))
  (new Range('a','z'))

const isUpper=
  chkOf("upper letter")
  (inRange('A','Z'))
  (new Range('A','Z'))

const isLetter=
  chkOf("letter")
  (o=>isLower(o)||isUpper(o))
  (new Ranges([isLower.domain,isUpper.domain]))

const isEof=
  chkOf("eof")
  (o=>typeof o==="undefined")
  (new Eof())

const isNotEof=
  chkOf("eof")
  (o=>typeof o!=="undefined")
  (new NotEof())

if(!exports) var exports={}

exports.prev=prev
exports.next=next
exports.isNone=isNone
exports.isAnyChar=isAnyChar
exports.isChar=isChar
exports.isOneOf=isOneOf
exports.isNoneOf=isNoneOf
exports.inRange=inRange
exports.notInRange=notInRange
exports.isLess=isLess
exports.isGreater=isGreater
exports.isDigit=isDigit
exports.isLower=isLower
exports.isUpper=isUpper
exports.isLetter=isLetter
exports.isAlphaNum=chkOf("alpha numeric")(o=>isLetter(o)||isDigit(o))()
exports.isHexDigit=chkOf("hex digit")(o=>isDigit(o)||inRange('a','f')(o)||inRange('A','F')(o))()
exports.isOctDigit=chkOf("octal digit")(inRange('0','7'))()
exports.isSpace=chkOf("space")(isChar(' '))()
exports.isTab=chkOf("tab")(isChar('\t'))()
exports.is_nl=chkOf("newline")(isChar('\n'))()
exports.is_cr=chkOf("carriage return")(isChar('\r'))()
exports.isBlank=chkOf("white space")(o=>exports.isSpace(o)||exports.isTab(o))()
exports.isEof=isEof
exports.isNotEof=isNotEof

//domains
exports.None=None
exports.Any=Any
exports.Point=Point
exports.Range=Range
exports.NotRange=NotRange
exports.Ranges=Ranges
exports.Less=Less
exports.Greater=Greater
exports.Set=Set
exports.Unset=Unset
exports.Eof=Eof
exports.NotEof=NotEof
// exports.=
// exports.=

// var r=inRange('a','z')
// var rr=inRanges(inRange('a','z'),inRange('A','Z'))
// var p=isChar('k')
// // r.exclude(p)
// // isAnyChar.exclude(r)
// clog(isEof.exclude(isAnyChar))
// clog(rr.exclude(p))
// clog(isLetter.exclude(isChar('a')))
// isAnyChar.exclude(isGreater('o')).domain
clog(isAnyChar.exclude(isOneOf('o')))
// inRanges(isChar('a'),isChar('b'),isChar('z'))('s')