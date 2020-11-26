"use strict";

//patch primitive data types
const {monoidString,monoidArray,empty}=require("./Monoid.js")
monoidString(String().__proto__)
monoidArray(Array().__proto__)

class T_Either {
  pure(o) {return Right(o)}//Monad instance
  when(o) {return isLeft(o)?o:this}//applicative instance this <* o | this << o
  then(o) {return o.when(this)}//applicative instance this *> o | this >> o
};

const isEither=o=>T_Either.prototype.isPrototypeOf(o);

class TC_Left extends T_Either {
  constructor(o) {
    super();
    this.value=o;
  }
  valueOf() {return false;}
  map(_) {return this;}//functor instance
  //mbind::m a->(a->m b)-> m b
  mbind(_){return this}//monad instance
  append(o){return o}//semigroup instance
  or(o){return o}//alternative instance
  app(o) {return isRight(o)?this.value(o):o}// (<*>) :: f (a -> b) -> f a -> f b
};

const Left=o=>new TC_Left(o);
const isLeft=o=>TC_Left.prototype.isPrototypeOf(o)

class TC_Right extends T_Either {
  constructor(o) {
    super();
    this.value=o;
  }
  map(f) {return Right(f(this.value));}//functor instance
  //mbind::m a->(a->m b)-> m b
  mbind(f){return f(this.value)}//monad instance
  append(o){return isLeft(o)?o:this.pure(this.value.append(o))}//semigroup instance
  or(_){return this}//alternative instance
};

const Right=o=>new TC_Right(o);
const isRight=o=>TC_Right.prototype.isPrototypeOf(o);

const fromLeft=o=>{
  if(isEither(o)) return isLeft(o)?o.value:undefined;
  throw("`fromLeft` of not `Either`")
}

const fromRight=o=>{
  if(isEither(o)) return isRight(o)?o.value:undefined;
  throw("`fromRight` of not `Either`")
}

exports.isEither=isEither;
exports.Left=Left;
exports.isLeft=isLeft;
exports.fromLeft=fromLeft;
exports.Right=Right;
exports.isRight=isRight;
exports.fromRight=fromRight;

// export {isEither, Left, isLeft, fromLeft, Right, isRight, fromRight};

