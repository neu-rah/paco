"use strict";

const { log, clog, xlog, debuging } = require("./src/debug")
const { Msg, Expect, Error } = require("./src/error")
const { SStr } = require("./src/strstr.js")

const {
  patchPrimitives,//patch primitive data types
  curry,//js curry style
  id, fcomp, fchain, constant, flip, cons,//Functional
  empty, append, mconcat,//Monoid
  head, tail,//List
  map,//Functor
  pure, mbind,//Monad
  Pair, fst, snd,//Pair (tupple)
  Maybe, isMaybe, Nothing, isNothing, Just, isJust, fromJust,//Maybe
  isEither, Left, isLeft, fromLeft, Right, isRight, fromRight,//Either
  foldable, foldr, foldl, foldr1, foldl1, foldMap,//foldable
} = require("funjs");

patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
)

//////////////////////////////////////////////////////////
// Parser

const {
  isAnyChar, isChar, isOneOf, isNoneOf, inRange,
  isDigit, isLower, isUpper, isLetter, isAlphaNum, isHexDigit, isOctDigit,
  isSpace, isTab, is_nl, is_cr, isBlank, isEof,
  Point, Set, Range,
} = require("./src/primitives")

const prim = require("./src/primitives")

const quickParam = p => typeof p === "string" ? (p.length === 1 ? char(p) : string(p)) : p

const parserOf=e=>f=>{
  clog("parserOf:",e)
  Object.setPrototypeOf(f,new Parser(e,f))
  return f
}

class Parser extends Function {
  constructor() {
    super('...args', 'return this.__self__._parse(...args)')
    var self = this.bind(this)
    this.__self__ = self
    return self
  }
  parse(s,ex) {return this(ex)(Pair(s, []))}
  // post(f) {return parserOf
  //   (this.expect+" verify of "+f)
  //   (ex=>io=>f(this(io)))}
  // chk(m,f) {return parserOf(this.expect+" check of "+f)
  //   (ex=>io=>{
  //     const r=this.onFailMsg(m)(io)
  //     if(isLeft(r)||f(fromRight(r).snd())) return r
  //     return Left(Pair(io.fst(),new Error(m)))
  //   })}

  then(p) {
    class Then extends Parser {
      constructor(o,p) {
        super()
        this.expect=o.expect + "\nthen " + p.expect
        this.parser=o
        this.next=p
      }
      _parse(ex) {return io => io.mbind(this.parser(this.next)).mbind(this.next(ex))}
    }
    return new Then(this,p)
  }

  skip(p) {
    class Skip extends Parser {
      constructor(o,p) {
        super()
        this.expect=o.expect + "\nskip " + p.expect
        this.parser=o
        this.next=p
      }
      _parse(ex) {
        return io => {
          const os = io.mbind(this.parser(p))
          return os.mbind(p(ex)).map(map(o => snd(fromRight(os))))
        }
      }
    }
    return new Skip(this,p)
  }

  lookAhead(p) {
    class LookAhead extends Parser {
      constructor(o,p) {
        super()
        this.expect=o.expect + " but look ahead for " + p.expect
        this.parser=o
        this.next=p
      }
      _parse(ex) {
        return io => {
          const r=this.parser(ex)(io)
          const ps = r.mbind(p())
          if (isLeft(ps)) return ps
          return r
        }
      }
    }
    return new LookAhead(this,p)
  }

  excluding(p) {
    class Excluding extends Parser {
      constructor(o,p){
        super()
        this.expect=o.expect+" excluding "+p.expect
        this.parser=p
        this.next=o
      }
      _parse(ex) {
        return io => {
          const ps = p(ex)(io)
          if (isRight(ps)) return Left(Pair(io.fst(), new Expect(this.expect)))
          return this.parser(ex)(io)
        }
      }
    }
    return new Excluding(this,p)
  }

  notFollowedBy(p) {
    class NotFollowedBy extends Parser {
      constructor(o,p) {
        super()
        this.expect=o.expect+" excluding "+p.expect
        this.parser=p
        this.next=o
      }
      _parse(ex) {
        return io => {
          const os = this.parser(ex)(io)
          const ps = os.mbind(this.next(ex))
          return isLeft(ps) ? os : Left(Pair(io.fst(), new Expect(this.expect)))
        }
      }
    }
    return new NotFollowedBy(this,p)
  }

  onFailMsg(msg) {
    class OnFailMsg extends Parser {
      constructor(o,msg) {
        super()
        this.expect=msg
        this.parser=o
      }
      _parse(ex) {
        return io => this.parser(ex)(io).or(Left(Pair(io.fst(), new Error(this.expect))))
      }
    }
    return new OnFailMsg(this,msg)
  }

  or(p) {
    class Or extends Parser {
      constructor(o,p) {
        super()
        this.expect=o.expect + " or " + p.expect
        this.parser=o
        this.next=p
      }
      _parse(ex) {
        return io => {
          const r = this.parser(ex)(io)
          if (isRight(r)) return r;//break `or` parameter expansion
          return r.or(p(ex)(io)).or(Left(Pair(io.fst(), new Expect(this.expect))))
        }
      }
    }
    return new Or(this,p)
  }

  as(f) {
    class As extends Parser {
      constructor(o,f) {
        const xfname = f => {//aux
          const ff = f.name || f.toString()
          return ff.length < 15 ? ff : ff.substr(0, 12) + "..."
        }
        super()
        this.expect="(" + o.expect + ")->as(" + xfname(f) + ")"
        this.parser=o
        this.func=f
      }
      _parse(ex) {return io=>Pair(io.fst(),[]).mbind(this.parser(ex)).map(map(f)).map(map(x=>io.snd().append(x)))}
    }
    return new As(this,f)
  }
  
  join(p) {
    class Join extends Parser {
      constructor(o,p) {
        super()
        this.expect=typeof p === "undefined" ? "(" + o.expect + ")->join()" : "(" + o.expect + ")->join(\"" + p + "\")"
        this.parser=o
        this.func=p
      }
      _parse(ex) {
        return io => 
          typeof p === "undefined" ? 
          this.parser.as(mconcat)(ex)(io) : 
          this.parser.as(o => o.join(p))(ex)(io)   
      }
    }
    return new Join(this,p)
  }
}

// Combinators --------------
class None extends Parser {
  constructor() {
    super()
    this.expect="none"
  }
  _parse(_) {return o=>Right(o)}
}
//parser always succeedes without consuming
// also an "id" combinator to apply continuations on root elements
const none = new None()

class Skip extends Parser {
  constructor(p) {
    super()
    this.expect="skip " + p.expect
    this.next=p
  }
  _parse(ex) {return none.skip(this.next)(ex)}
}
//apply skip (continuation) to the root element, using `none` combinator
const skip = o=>new Skip(o)

class Satisfy extends Parser {
  constructor(chk) {
    super()
    this.expect=chk.expect || "to satisfy condition"
    this.chk=chk
  }
  _parse(ex) {
    return io=>{return this.chk(head(io.fst())) ?
      Right(//success...
        Pair(//build a pair of remaining input and composed output
          tail(io.fst()),//consume input
          io.snd().append([head(io.fst())])))//compose the outputs
      : Left(Pair(io.fst(), new Expect(this.expect)))//or report error
    }
  }
}
// //check a character with a boolean function
const satisfy = chk => new Satisfy(chk)
const any=satisfy(isAnyChar)

class Str extends Parser {
  constructor(str) {
    super()
    this.expect="string `" + str + "`"
    this.str=str
  }
  _parse(ex) {
    return (foldr1(a=>b=>b.then(a))(this.str.split("").map(o=>char(o))).join())(ex)
  }
}
// //match a string
const string = str => new Str(str)

class Regex extends Parser {
  constructor(e) {
    super()
    this.expect="regex /" + e + "/"
    this.expr=e
  }
  _parse(ex) {
    return io => {
      const r = io.fst().match(this.expr)
      return r === null ?
        Left(Pair(io.fst(), new Expect(regex(e).expect))) :
        Right(
          Pair(
            r.input.substr(r[0].length),
            r.length === 1 ? [r[0]] : r.slice(1, r.length)
          )
        )
    }
  }
}
//regex match
const regex=e=>new Regex(e)

// //character parsers
const anyChar = satisfy(isAnyChar)
const char = c => satisfy(isChar(c))
const oneOf = cs => satisfy(isOneOf(cs))
const noneOf = cs => satisfy(isNoneOf(cs))
const range = curry((a, z) => parserOf(inRange(a, z).expect)(c => satisfy(inRange(a, z))(c)))
const digit = satisfy(isDigit)
const lower = satisfy(isLower)
const upper = satisfy(isUpper)
const letter = satisfy(isLetter)
const alphaNum = satisfy(isAlphaNum)
const hexDigit = satisfy(isHexDigit)
const octDigit = satisfy(isOctDigit)
const space = satisfy(isSpace); space.expect = "space"
const tab = satisfy(isTab); tab.expect = "tab"
const nl = satisfy(is_nl); nl.expect = "new-line"
const cr = satisfy(is_cr); cr.expect = "carryage return"
const blank = satisfy(isBlank)
const eof = satisfy(isEof)

// //meta-parsers
// const optional = p => parserOf("optional " + p.expect)(ex => io => p(ex)(io).or(Right(io)))

// const choice = ps => foldl1(a => b => a.or(b))(ps)

// //TODO, this is NOT manyTill, we gota mix in the lookAhead for cases
// // like: didits.then(digit)
// const many = 
//   p => parserOf("many("+p.expect+")")
//   (ex => io => {
//     if(ex) {
//       return many(
//         parserOf(p.expect+" but "+ex.expect)
//         (_=>i=>p.excluding(ex)()(i).or(p.lookAhead(ex)()(i)))
//       )()(io)
//     }
//     return p.then(many(p))(ex)(io).or(Right(io))
//   })

// const many1 = p => parserOf("at least one " + p.expect)(p.then(many(p)))

// const manyTill = curry((p, e) => parserOf
//   ("many " + p.expect + " until " + e.expect)
//   (ex=>io=>p.excluding(e).then(manyTill(p,e))()(io).or(Right(io))))


// const count = curry((n, p) => parserOf(n + " of " + p.expect)
//   (ex => io => io.snd().length < n ? p.then(count(n)(p))(ex)(io) : Right(io)))

// const between = curry((open, p, close) => skip(open).then(p).skip(close))

// const option = curry(
//   (x, p) => parserOf("option " + p.expect+" else "+x)
//     (ex => io => p(ex)(io).or(Right(Pair(io.fst(), x)))))

// const optionMaybe = p => parserOf("maybe " + p.expect)(ex => io => p.as(Just)(io).or(Right(Pair(io.fst(), Nothing()))))

// const sepBy = curry((p, sep) => parserOf(p.expect + " separated by " + sep.expect)
//   (ex => io => p.then(many(skip(sep).then(p)))(ex)(io)))//.or(Right(Pair(io.fst(),[]))))

// const sepBy1 = curry((p, sep) => parserOf(p.expect + " separated by " + sep.expect)
//   (ex => io => p.then(many(skip(sep).then(p)))(ex)(io)))

// const endBy = curry((p, sep, end) => sepBy(p)(sep).then(skip(end)))

// const endBy1 = curry((p, sep, end) => sepBy1(p)(sep).then(skip(end)))

// //high order character parser
// const spaces = many(space); spaces.expect = "spaces"//TODO: this expect adjoin is not working
// const blanks = many(blank); blanks.expect = "white space"
// const spaces1 = many1(space); spaces1.expect = "at least one space"
// const blanks1 = many1(blank); blanks1.expect = "some white space"
// const digits = many(digit); digits.expect = "digits"

// //interpret a result and enventually build an error message
// const res = curry((fn, r) => {
//   if (isRight(r)) return r.map(snd)
//   else {
//     // fn=typeof fn==="undefined"?">":fn
//     const rr = fromLeft(r)
//     var fpos = fn
//     if (typeof rr.fst().line !== "undefined") {
//       const pos = rr.fst().getPos()
//       fpos += ":" + pos.join(":") + "\n"
//     }
//     const found = head(rr.fst())//the char to blame
//     return rr.snd().isError() ?
//       Left(fpos + "error, " + rr.snd()) :
//       Left(
//         fpos + "error, expecting " + rr.snd()
//         + " but found `" + (found || "eof") + "`"
//         + (found ? " here->" + rr.fst().toString().substr(0, 10) + "..." : "")//TODO: this is expensive, refactor! (functional `take n`)
//       )
//   }
// })

// const parse = curry((fn, p, str) => res(fn)(p()(Pair(str, []))))

// if (!exports) var exports = {}

// exports.satisfy = satisfy
// exports.anyChar = anyChar
// exports.char = char
// exports.oneOf = oneOf
// exports.noneOf = noneOf
// exports.range = range
// exports.digit = digit
// exports.lower = lower
// exports.upper = upper
// exports.letter = letter
// exports.alphaNum = alphaNum
// exports.hexDigit = hexDigit
// exports.octDigit = octDigit
// exports.space = space
// exports.tab = tab
// exports.nl = nl
// exports.cr = cr
// exports.blank = blank
// exports.spaces = spaces
// exports.blanks = blanks
// exports.spaces1 = spaces1
// exports.blanks1 = blanks1
// exports.digits = digits
// exports.eof = eof
// exports.string = string
// exports.regex = regex

// exports.none = none
// exports.skip = skip
// exports.many = many
// exports.many1 = many1
// exports.manyTill = manyTill
// exports.optional = optional
// exports.choice = choice
// exports.count = count
// exports.between = between
// exports.option = option
// exports.optionMaybe = optionMaybe
// exports.sepBy = sepBy
// exports.sepBy1 = sepBy1
// exports.endBy = endBy
// exports.endBy1 = endBy1
// exports.res = res
// exports.parse = parse
// exports.parserOf = parserOf
// exports.Pair=Pair
// exports.SStr=SStr