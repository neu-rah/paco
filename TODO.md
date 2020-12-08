abreviate chat and string by just providing a string

optimize
- many(skip(x)) to skip(many(x))
- char('x').then(char('y')) to string("xy")
- chat('x').or(char('y')) to oneOf("xy")