# PaCo

**javascript monadic parser combinators**

```javascript
const p=
  skip(char('#'))
  .then(many(letter).join(""))
  .skip(char('-'))
  .then(digits.join("").as(o=>o*1))

parse(p)("#AN-123")
```

outputs:
```javascript
TC_Right { value: [ 'AN', 123 ] }
```

All parsers can chain up or group to form other parsers.

The chaining is done with `.then` or `.skip`, the first combines the output, while the second will drop it.

Parsers can alternate with `.or`

Parse output can be formated with `.as`, it will apply to the parser or group where inserted. `.as` will accept an output transformer function.

Output transformations can stack up.

`.join()` and `.join(«sep»)` are shortcuts for `.as(mappend)` and `.as(o=>o.join(«sep»))`

Parsers can group by nesting ex: `x.then( y.then(z).join("") )`, here the join will only apply to the (y.z) results.

For now parsers accept a state pair of (input,output) and will return `Either` a pair of input state and an error string or a pair od input state and parsed content.

_*expect changes on this arguments format_

Some available metaparsers like `many()`, `many1`, `skip()` can accept other parsers or metaparsers.

Some parsers are already a composition with metaparses, that the case of `digits`, it will perform `many(digit)`.

`.failsWith(msg)` provides a message for failing parser

`.parse("...")` can be used to quick feed a string to any parser.
The result will include both input and output state.

_use `parse` function to get only output_

all transformation definitions should be applyed to the parser and not to the result, so `.parse` should be the last item of the group.

a parser can be stored, combined, passed around and perform parsing on many contents many times, all transitory state is kept outside.

### Still missing

**Lazyness** right now the alternative parsers will ALL try to parse due to the strict nature of javascript.

## Examples

testing a simple parser

```javascript
#>digits(Pair("123",[]))
TC_Right { value: TC_Pair { a: '', b: [ '1', '2', '3' ] } }
```
This is the basic form of parsing (feeding a parser). However a `parse` function is available:

it will perform as the former but with only output state

```javascript
#>parse(digits)("123")
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
#>parse(many1(digit))("#123")
TC_Left { value: 'error, expecting digit but found `#` here->#123' }
```
## Composition examples

```javascript
  parse( 
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

  parse(nr)(" 123 , 25 | 3")
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

- **skip(...)** ignore the group/parser output

- **many(p)** optional many ocourences or parser `p` targets. This parser never fails as it can return an empty list.

- **many1(p)** one or more ocourences of parser `p` targets

- **optional(p)** parse `p` if present, otherwise ignore and continue parsing

- **choice\[ps]** parse from a list of alternative parsers, this is just an abbreviation of `.or` sequence.

- **count(n)(p)** parses `n` ocourences of `p`

- **between(open)(p)(close)** parses `p` surounded by `open` and `close`, dropping the delimiters

- **option(x)(p)** parses `p` or returns `x` if it fails, this parser never fails.

- **optionMaybe(p)** parse `p` and returns `Just` the result or `Nothing` if it fails, this parser never fails

- **sepBy(p)(sep)** parses zero or more ocourences of `p` separated by `sep` and droping the separators, this parser never fails.

- **sepBy1(p)(sep)** parses one or more ocourences of `p` separated by `sep` and droping the separators, this parser never fails.

- **endBy(p)(sep)(end)** parses zero or more ocourences of `p` separated by `sep` droping the separators and terminating with `end`

- **endBy1(p)(sep)(end)** parses one or more ocourences of `p` separated by `sep` droping the separators and terminating with `end`

- **boot()** non-consume happy parser.

> boot is an identity parser, will just output the given input as a successful parse. So it never fails or consumes.  
We use it to turn binary combinators into unary metaparsers. That is the case of `.skip(...)`, it uses the `boot()` parser to be available as a unary modifier `skip()`.  
`boot()` can do so for any binary combinator.  

```haskell
Right . id
```

## utility

- **parse** `parse(parser)(input string)`

```javascript
#>parse(letter.or(digit))("1")
TC_Right { value: [ '1' ] }
#>parse(letter.or(digit))("a")
TC_Right { value: [ 'a' ] }
#>parse(letter.or(digit))("#123")
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
