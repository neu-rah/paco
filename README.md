# PaCo

**javascript monadic parser combinators**

> version 1.1 is a full re-write with focus on speed  
also, output pair content swaped  
`many1` replaced by `some`  
`onFailMsg` replaced by `failMsg`  
Parsers are no longuer functions (they are classes and do not derive from Function anymore) so they must be called with `.run` instead of direct function call.

This is a tool for building parsers and parse, so that you do not have to be a parser expert to do it.

```javascript
const myParser=
  skip(char('#'))
  .then(many(letter).join())
  .skip(char('-'))
  .then(digits.join().as(parseInt))

parse(">")(myParser)("#AN-123")
```
outputs:
```javascript
Right { value: [ 'AN', 123 ] }
```

All parsers can chain up or group to form other parsers that still can chain up and group.

Some available metaparsers like `many()`, `some()`, `skip()` can accept other parsers or metaparsers.

Some parsers are already a composition with metaparsers, that is the case of `digits`, it will perform `many(digit)`.

**abbreviations**

a single string can now be used in place of a non-chaining parser and it will translate either to a `char` or `string` parser.

> `digits.then('.')` is valid as `digits.then(char('.'))`

## Building objects

`.to(tag)` extender will grab the current parsing group result and store it on object key `tag`

if an object does not exist yet it is created, if there is already an object on the results tail it will be used.

```javascript
const kchk=
  string("temp: ")
  .then(
    option("",oneOf("-+"))
    .then(digits)
    .join().as(parseInt).to("temp")
    .then(char('K').to("unit"))
    .verify(o=>o[0].temp>=0,"negative Kelvin!")
  )
```
```javascript
#>res(">")(kchk.parse("temp: +12K"))
Right { value: [ { temp: [ 12 ], unit: [ 'K' ] } ] }
```

this, along `.verify`, `.post` and `.as` allow event callbacks and all sort of automation during the parsing, if not then let me know.

**It's now possible to parse this:** _enable/disable by config_

Enable with `config.backtrackExclusions=true`

```javascript
#>config.optimize=true//turn on optimizations on construction
#>config.backtrackExclusions=true//track exclusions on optimization
#>digits.join().as(parseInt).then(count(2,digit).join()).parse("12345")
Right { value: Pair { a: [ 123, '45' ], b: '' } }
```
`.then`, `.skip` and others can inject exclusion checks on the chain at construction time.
We allow the parser base to be re-writen at construction time, keeping away all checking from parse time.

`many` will peek this injected parameters and possibly exclude them from the sequence match

> one can still call `.optim` even with optimizations turned off  
however backtrack will still respect its flag

>optimization chain is not very populated yet, there are many things to fit in...

## Config

**module exported variable **

```javascript
var config={
  optimize:false,//all optimizations
  backtrackExclusions: false//exclude next selector root from current loop match
}
```
- **optimize** disable all optimizations when false

- **backtrackExclusions** exclude next parser root from the current selection  

> backtrack can be dismissed for well writen parsers  
(there is still a ling way to go here)

---
## .then | .skip
The chaining is done with `.then` or `.skip`, the first combines the output, while the second will drop it.

## .or
Parsers can alternate with `.or`

## .notFollowedBy(p)

parser succeeds only if `p` fails

## .lookAhead(p)

predicated `p` with no consume before parsing, if `p` fails the parsing will fail

## .excluding(p)

predicated `p` before parsing, if `p` succeedes the parsing will fail

_this could be achieved by grouping parsers instead of separate them, but some grammars are writen so_

**must apply to same level parser**. using `.excluding(char(..))` at character level on a string level parser will have no effect

```javascript
digits.excluding(oneOf("89"))//this will have no effect
many(digit.excluding(oneOf("89")))//but this will
```

> if optimizatumizing wuth exclusion back-track, the the first will have effect

## .as
Parse output can be formated with `.as`, it will apply to the parser or group where inserted. `.as` will accept an output transformer function.

Output transformations can stack up.

## .join
`.join()` and `.join(«sep»)` are shortcuts for `.as(mappend)` and `.as(o=>o.join(«sep»))`

Parsers can group by nesting ex: `x.then( y.then(z).join() )`, here the `join` will only apply to the (y.z) results.

TODO: this (grouping) is not fully generalized yet

## .verify
`.verify(func,msg)` function `func` will receive the parse group result (list) and should return `true` if approved or `false` to resume in error with message `msg`.

## .post
`.post(f)` post-processing the result, this is still a static parser definition. Function `f` return will replace the previous result.

## .failMsg
`.onFailMsg(msg)` provides a message for a failing parser

## .parse
`.parse("...")` can be used to quick feed a string to any parser.
The result will include both input and output state.

>ex: `digits.parse("123a")`

_use `parse` function to get only output_

all transformation definitions should be applyed to the parser and not to the result, so `.parse` should be the last item of the group.

a parser can be stored, combined, passed around and perform parsing on many contents many times, all transitory state is kept outside.

### -- failing --

this parse will fail as it expects at least one digit

```javascript
#>parse(">")(some(digit))("#123")
Left { value: 'error, expecting digit but found `#` here->#123' }
```
## Composition examples

```javascript
  parse(">")( 
    many(
      some(digit.or(letter)).join()
      .skip(spaces)
    ).join("-")
  )("As armas e os baroes")
```

expected result
```javascript
Right { value: [ 'As-armas-e-os-baroes' ] }
```

```javascript
const nr=
  skip(spaces)
  .then(digits).join().as(parseInt)//get first digits as number
  .then(many(//then seek many separated by `,` or '|'
    skip(spaces)
    .skip(char(',').or(char('|')))//drop the separators (not included in output)
    .skip(spaces)
    .then(digits.join().as(parseInt))
  )).as(foldr1(a=>b=>a+b))//transform output by adding all values

parse(">")(nr)(" 12 , 2 | 1")
```

expected result
```javascript
Right { value: [ 15 ] }
```

_above parser could be writen using `sepBy`, we were just emphasizing the combinatory_

## Parsers

- **satisfy(f)** uses a function `char->bool` to evaluate a character

- **char(c)** matches charater `c`

- **cases(c)** case insensitive character `c` match

- **oneOf("...")** matches any given string character

- **noneOf("...")** matches any character not included in string

- **range(a,z)** matches characters between the given ones (inclusive)

- **digit** any digit `0-9`

- **lower** lower case letters `a-z`

- **upper** upper case letters `A-Z`

- **letter** any letter `a-z` or `A-Z`

- **alphaNum** letter or digit

- **hexDigit** hexadecimal digit

- **octDigit** octal digit

- **space** single space

- **tab** single tab

- **nl** newline

- **cr** carriage return

- **blank** tab or space

- **spaces** optional many space

- **blanks** optional many white space

- ~~**spaces1** one or more spaces~~

- ~~**blanks1** one or more white spaces~~

- **digits** optional many digits

- **eof** end of file

- **string("...")** match with given string

- ~~**caseInsensitive("...")** non case-sensitive string match~~

- **regex(expr)** match with regex expression

```javascript
#>parse(">")(regex("#([a-zA-Z]+)[ -]([0-9]+)"))("#an-123...")
Right { value: [ 'an', '123' ] }
```

- **skip(...)** ignore the group/parser output

- **many(p)** optional many ocourences or parser `p` targets. This parser never fails as it can return an empty list.

- **some(p)** one or more ocourences of parser `p` targets

- **manyTill(p,end)** one or more ocourences of parser `p` terminating with parser `end`

- **optional(p)** parse `p` if present, otherwise ignore and continue parsing

- **choice[ps]** parse from a list of alternative parsers, this is just an abbreviation of `.or` sequence.

- **count(n)(p)** parses `n` ocourences of `p`

- **between(open)(close)(p)** parses `p` surounded by `open` and `close`, dropping the delimiters.  
Be sure to exclude the delimiters from the content or provide any other meaning of content end

```javascript
#>parse(">")(between(space,space,some(noneOf(" "))).join())(" ab.12 ")
Right { value: [ 'ab.12' ] }
```

- **option(x)(p)** parses `p` or returns `x` if it fails, this parser never fails.

```javascript
#>parse(">")(option(["0"])(digit))("1")
Right { value: [ '1' ] }
#>parse(">")(option(["0"])(digit))("")
Right { value: [ '0' ] }
#>parse(">")(option(["0"])(digit))("#")
Right { value: [ '0' ] }
```

- **optionMaybe(p)** parse `p` and returns `Just` the result or `Nothing` if it fails, this parser never fails

- **sepBy(p)(sep)** parses zero or more ocourences of `p` separated by `sep` and droping the separators, this parser never fails.

- **sepBy1(p)(sep)** parses one or more ocourences of `p` separated by `sep` and droping the separators, this parser never fails.

- **endBy(p)(sep)(end)** parses zero or more ocourences of `p` separated by `sep` droping the separators and terminating with `end`

- **endBy1(p)(sep)(end)** parses one or more ocourences of `p` separated by `sep` droping the separators and terminating with `end`

- **none** non-consume happy parser.

> none is an identity parser, will just output the given input as a successful parse. So it never fails or consumes.  
We use it to turn binary combinators into unary metaparsers. That is the case of `.skip(...)`, it uses the `none` parser to be available as a unary modifier `skip()`.  
`none` can do so for any binary combinator and can apear where you want to disable a part.  

> using `none` as `sep` with `endBy(p,sep,end)` whill silentrly skip the `sep` need.

## try and consume

Untill now, all failing parsers do not consume... lets see... while so, no need to inplement **try*

> to be more accurate, failing parsers do consume, we need the failing point on the reports, however the upper parser might pick the starting point to move on, ignoring the consume (as **try** do).

## Parsers basic IO

For now parsers accept a state pair of (input,output) and will return `Either`:  

- on error: a pair of an error and the input state.
- on success: a pair of parsed content and the input state.

_*expect changes on this arguments format (changed on v1.1)_

testing a simple parser

```javascript
#>digits.run(Pair([],"123"))
Right { value: Pair { a: [ '1', '2', '3' ], b: '' } }
```
This is the basic form of parsing (feeding a parser). 

However a `parse` function is available, it will perform as the former but gives only output state or a fancy error message.

```javascript
#>parse(">")(digits)("123")
Right { value: [ '1', '2', '3' ] }
```
Same with

```javascript
#>digits.parse("123")
Right { value: Pair { a: [ '1', '2', '3' ], b: '' } }
```
the only difference is that this last one, as the first will give full output, including the input state.

## utility

### **parse** 

`parse(filename)(parser)(input string or stream)`

the filename is merelly a decoration here, to be used on error report

```javascript
#>parse(">")(letter.or(digit))("1")
Right { value: [ '1' ] }
#>parse(">")(letter.or(digit))("a")
Right { value: [ 'a' ] }
#>parse(">")(letter.or(digit))("#123")
Left {
  value: 'error, expecting letter or digit but found `#` here->#123' }
```

direct parse
```javascript
#>letter.or(digit).parse("1")
Right { value: Pair { a: '', b: [ '1' ] } }
#>letter.or(digit).parse("a")
Right { value: Pair { a: '', b: [ 'a' ] } }
#>letter.or(digit).parse("#123")
Left { value: Pair { a: '#123', b: 'letter or digit' } }
```

desugared parse
```javascript
#>letter.or(digit).run(Pair("1",[]))
Right { value: Pair { a: '', b: [ '1' ] } }
#>letter.or(digit).run(Pair("a",[]))
Right { value: Pair { a: '', b: [ 'a' ] } }
#>letter.or(digit).run(Pair("#123",[]))
Left { value: Pair { a: '#123', b: 'letter or digit' } }
```

### **res(r)** 

process a parser return to produce a result or error message, discarding input state description.

```javascript
#>res(">")(letter.then(digits).parse("123"))
Left { value: '>error, expecting letter but found `1` here->1...' }
```
without `res()` procesing
```javascript
#>letter.then(digits).parse("123")
Left { value: Pair { a: '123', b: 'letter' } }
```

### **.expect**

as a consequence of the error report system we got a parser description for free, no great effort was put to it thou

```javascript
const p=
  optional(skip(char('#')))
  .then(some(letter).join())
  .skip(char('-').or(spaces1))
  .then(digits.join().as(parseInt))
```

description:
```javascript
#>console.log(p.expect)
```
```text
optional skip character `#`
then (at least one letter)->join()
skip character `-` or at least one space
then ((digits)->join())->as(parseInt)
```
using:
```javascript
#>console.log(parse(">")(p)("#AN-123"))
Right { value: [ 'AN', 123 ] }
```

_this parser is inspired but not following "parsec"_
