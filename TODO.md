abreviate chat and string by just providing a string

optimize
- many(skip(x)) to skip(many(x))
- char('x').then(char('y')) to string("xy")
- chat('x').or(char('y')) to oneOf("xy")

`many(x).then(many(y))` where `x` can partial or toatally match `y`

this is solved for `many(x).then(o)` but ignored on high order `o`

still it is possible by obtaining the many target and combining it

`many(x).then(many(y))` **=>** `many(x but not y).then(many(y))`

provided that the root is at character level

thee root of a parser... (above as `y`)

- digit.then(many(letter)) => digit
- many(letter) => letter
- leter.or(digit) => leter.or(digit)
- letter.or(many(digit)) => letter.or(digit)

this can be done by obtaining the root of all members ;)

being that we dont traverse `.then` obly the first ocourence matters

on the first occourence, `many` will further reduce while `or`, `notFolloedBy`, `excluding`, etc... will do an fmap of the reductions
