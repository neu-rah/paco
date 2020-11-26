# PaCo

**javascript monadic parser combinators**

All parsers can chain up or group to form other parsers.

The chaining is done with `.then` or `.skip`, the first combines the output, while the second will drop it.

Parsers can alternate with `.or`

Parse output can be formated with `.as`, it will apply to the parser or group where inserted. `.as` wil accept an output transformer function.

Output transformations can stack up.

`.join()` or `.join(«sep»)` are shortcuts for `.as(mappend)` and `.as(o=>o.join(«sep»))`

Parsers can group by nesting ex: `x.then(y.then(z).join(""))`, here the join will only apply to the (y.z) results.

For now parsers accept a state pair of (input,output) and will return `Either` an error string or a resulting state pair.

_* expect changes on this arguments_

Some available metaparsers like `many()`, `many1`, `skip()` can accept other parsers or metaparsers.

Some parsers are already a composition with metaparses, that the case of `digits`, it will perform `many(digit)`.

## Examples

testing a simple parser

```javascript
digits(Pair("123",[]))
```

This is the basic for of parsing (feeding a parser). However a `parse` function is available:

```javascript
parse(digit)("123")
```

it will performe as the former.

a parser can be stored, passed around and perform parsing on many contents many times, all transitory state is keep outside.

```javascript
const nr=
  digits.join("").as(o=>o*1)//get first digits as number
  .then(many(//then seek many separated by `,`
    skip(char(','))//drop the separator (not included in output)
    .then(digits.join("").as(o=>o*1))
  )).as(foldr1(a=>b=>a+b))//transform output by summing all values

parse(nr)("123,25,3")

```

expected result
```javascript
TC_Right { value: [ 151 ] }
```

## Parsers

- **satisfy(f)** uses a function `char->bool` to evaluate a character

- **char(c)** matches charater `c`

- **oneOf("...")** matches any given string character

- **noneOf("...")** matches charcated not included in string

- **range(a,z)** matches characters between the given ones (inclusive)

- **digit** any digit `0-9`

- **lower** lower case letters

- **upper** upper case letters

- **letter** any letter

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

- **boot** non-consume happy parser

- **skip** ignore the group/parser output

- **many(p)** optional many ocourences or parser `p`

- **many1** one or more ocourences of parser `p`

## utility

- **parse** `parse(parser)(input string)`

