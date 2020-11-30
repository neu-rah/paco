# PaCo

**javascript monadic parser combinators**

```javascript
const p=
  skip(char('#'))
  .then(many(letter).join(""))
  .skip(char('-'))
  .then(digits.join("").as(o=>o*1))

parse(">")(p)("#AN-123")
```
> _note: `parseInt` could have been used in place of `o=>o*1`_

outputs:
```javascript
TC_Right { value: [ 'AN', 123 ] }
```

All parsers can chain up or group to form other parsers.

For now parsers accept a state pair of (input,output) and will return `Either` a pair of input state and an error or a pair of input state and parsed content.

_*expect changes on this arguments format_

Some available metaparsers like `many()`, `many1()`, `skip()` can accept other parsers or metaparsers.

Some parsers are already a composition with metaparsers, that is the case of `digits`, it will perform `many(digit)`.

---
## .then | .skip
The chaining is done with `.then` or `.skip`, the first combines the output, while the second will drop it.

## .or
Parsers can alternate with `.or`

## .notFollowedBy(p)

parser succeeds only if `p` fails

## .as
Parse output can be formated with `.as`, it will apply to the parser or group where inserted. `.as` will accept an output transformer function.

Output transformations can stack up.

## .join
`.join()` and `.join(«sep»)` are shortcuts for `.as(mappend)` and `.as(o=>o.join(«sep»))`

Parsers can group by nesting ex: `x.then( y.then(z).join("") )`, here the join will only apply to the (y.z) results.

## .chk
`.chk(m)(f)` this function `f` will receive the parse group  result (list) and should return `true` if approved or `false` to resume in error with message `m`.

## .post
`.post(f)` post-processing the result, this is still a static parser definition. Function `f` return will replace the previous result.

## .onFailMsg
`.onFailMsg(msg)` provides a message for a failing parser

## .parse
`.parse("...")` can be used to quick feed a string to any parser.
The result will include both input and output state.  

_use `parse` function to get only output_

all transformation definitions should be applyed to the parser and not to the result, so `.parse` should be the last item of the group.

a parser can be stored, combined, passed around and perform parsing on many contents many times, all transitory state is kept outside.

## try and consume

Untill now, all failing parsers do not consume... lets see... while so, no need to inplement **try*

## Still missing

~~**Lazyness** right now the alternative parsers will ALL try to parse due to the strict nature of javascript.~~
_inserted a strict check between the alternative sequence to avoid the need of lazyness._

## Examples

testing a simple parser

```javascript
#>digits(Pair("123",[]))
TC_Right { value: TC_Pair { a: '', b: [ '1', '2', '3' ] } }
```
This is the basic form of parsing (feeding a parser). 

However a `parse` function is available, it will perform as the former but gives only output state or a fancy error message.

```javascript
#>parse(">")(digits)("123")
TC_Right { value: [ '1', '2', '3' ] }
```
Same with

```javascript
#>digits.parse("123")
TC_Right { value: TC_Pair { a: '', b: [ '1', '2', '3' ] } }
```

the only difference is that this last one, as the first will give full output, including the input state.

### -- failing --

this parse will fail as it expects at least one digit

```javascript
#>parse(">")(many1(digit))("#123")
TC_Left { value: 'error, expecting digit but found `#` here->#123' }
```
## Composition examples

```javascript
  parse(">")( 
    many(
      many1(digit.or(letter)).join()
      .skip(spaces)
    ).join("-")
  )("As armas e os baroes")
```

expected result
```javascript
TC_Right { value: [ 'As-armas-e-os-baroes' ] }
```

```javascript
const nr=
  skip(spaces)
  .then(digits).join("").as(o=>o*1)//get first digits as number
  .then(many(//then seek many separated by `,`
    skip(spaces)
    .skip(char(',').or(char('|')))//drop the separator (not included in output)
    .skip(spaces)
    .then(digits.join("").as(o=>o*1))
  )).as(foldr1(a=>b=>a+b))//transform output by summing all values

  parse(">")(nr)(" 123 , 25 | 3")
```

expected result
```javascript
TC_Right { value: [ 151 ] }
```

## Parsers

- **satisfy(f)** uses a function `char->bool` to evaluate a character

- **char(c)** matches charater `c`

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

- **spaces1** one or more spaces

- **blanks1** one or more white spaces

- **digits** optional many digits

- **eof** end of file

- **string("...")** match with given string

- **regex(expr)** match with regex expression

```javascript
#>parse(">")(regex("#([a-zA-Z]+)[ -]([0-9]+)"))("#an-123...")
TC_Right { value: [ 'an', '123' ] }
```

- **skip(...)** ignore the group/parser output

- **many(p)** optional many ocourences or parser `p` targets. This parser never fails as it can return an empty list.

- **many1(p)** one or more ocourences of parser `p` targets

- **manyTill(p,end)** one or more ocourences of parser `p` terminating with parser `end`

- **optional(p)** parse `p` if present, otherwise ignore and continue parsing

- **choice\[ps]** parse from a list of alternative parsers, this is just an abbreviation of `.or` sequence.

- **count(n)(p)** parses `n` ocourences of `p`

- **between(open)(p)(close)** parses `p` surounded by `open` and `close`, dropping the delimiters.  
Be sure to exclude the delimiters from the content or provide any other meaning of content end

```javascript
#>parse(">")(between(space)(many1(noneOf(" ")))(space).join())(" ab.12 ")
TC_Right { value: [ 'ab.12' ] }
```

- **option(x)(p)** parses `p` or returns `x` if it fails, this parser never fails.

```javascript
#>parse(">")(option(["0"])(digit))("1")
TC_Right { value: [ '1' ] }
#>parse(">")(option(["0"])(digit))("")
TC_Right { value: [ '0' ] }
#>parse(">")(option(["0"])(digit))("#")
TC_Right { value: [ '0' ] }
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

```haskell
Right . id
```

## utility

- **parse** 

`parse(filename)(parser)(input string or stream)`

```javascript
#>parse(">")(letter.or(digit))("1")
TC_Right { value: [ '1' ] }
#>parse(">")(letter.or(digit))("a")
TC_Right { value: [ 'a' ] }
#>parse(">")(letter.or(digit))("#123")
TC_Left {
  value: 'error, expecting letter or digit but found `#` here->#123' }
```

direct parse
```javascript
#>letter.or(digit).parse("1")
TC_Right { value: TC_Pair { a: '', b: [ '1' ] } }
#>letter.or(digit).parse("a")
TC_Right { value: TC_Pair { a: '', b: [ 'a' ] } }
#>letter.or(digit).parse("#123")
TC_Left { value: TC_Pair { a: '#123', b: 'letter or digit' } }
```

desugared parse
```javascript
#>letter.or(digit)(Pair("1",[]))
TC_Right { value: TC_Pair { a: '', b: [ '1' ] } }
#>letter.or(digit)(Pair("a",[]))
TC_Right { value: TC_Pair { a: '', b: [ 'a' ] } }
#>letter.or(digit)(Pair("#123",[]))
TC_Left { value: TC_Pair { a: '#123', b: 'letter or digit' } }
```

- **res(r)** 

process a parser return to produce a result or error message, discarding input state description.

```javascript
#>res(">")(letter.then(digits).parse("123"))
TC_Left { value: '>error, expecting letter but found `1` here->1...' }
```
without `res()` procesing
```javascript
#>letter.then(digits).parse("123")
TC_Left { value: TC_Pair { a: '123', b: 'letter' } }
```

- **.expect**

as a consequence of the error report system we got a parser description for free, no great effort was put to it thou

```javascript
#>console.log(optional(skip(char('#'))).then(many1(letter).join()).skip(char('-').or(spaces1)).then(digits.join().as(parseInt)).expect)
```
obtained description:
```text
optional skip character `#`
then (at least one letter)->join()
skip character `-` or at least one space
then ((digits)->join())->as(parseInt)
```

running:
```javascript
const p=
  optional(skip(char('#')))
  .then(many1(letter).join())
  .skip(char('-').or(spaces1))
  .then(digits.join().as(parseInt))

console.log(parse(">")(p)("#AN-123"))
```
result:
```javascript
TC_Right { value: [ 'AN', 123 ] }
```
