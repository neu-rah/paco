const assert = require("assert");

const {
  patchPrimitives,//patch primitive data types
  id,fcomp,fchain,constant,flip,cons,//Functional
  empty,append,mconcat,//Monoid
  head,tail,//List
  map,drop,//Functor
  pure,app,//Applicative
  /*pure,*/mbind,//Monad
  Pair,fst,snd,//Pair (tupple)
  Maybe,isMaybe,Nothing,isNothing,Just,isJust,fromJust,//Maybe
  isEither,Left,isLeft,fromLeft,Right,isRight,fromRight,//Either
  foldable,foldr,foldl,foldr1,foldl1,foldMap,//foldable
} = require("../funjs.js");

patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
)

///////////////////////////////////////////
// test stuff
describe("Functional",function() {
  it("utility functions",async ()=>{
    const e=x=>x/2
    const f=x=>x+2
    const g=x=>x*10
    assert(id(0)===0&&id("ok")==="ok","not reflecting")
    assert(fcomp(f)(g)(4)===42,"fcomp")
    assert(fchain(e,f,g)(4)===21)
    assert(constant(0)(1)===0)
    assert(flip(a=>b=>a/b)(1)(2)===2)
    assert(cons(1,[]).length===1)
    assert.deepStrictEqual(cons(2)(cons(1,[])), [2,1])
  })
})

describe("Semigroup/Monoid",function() {
  it("Semigroup and monoid functions",async ()=>{
    assert(typeof Function().__proto__.append==="function","primitive function type not Semigroup patched")
    assert(typeof Function().__proto__.empty==="function","primitive function type not Monoid patched")
    assert(typeof String().__proto__.append==="function","primitive String type not Semigroup patched")
    assert(typeof String().__proto__.empty==="string","primitive String type not Monoid patched")
    assert(typeof Array().__proto__.append==="function","primitive Array type not Semigroup patched")
    assert.deepStrictEqual(Array().__proto__.empty,[],"primitive Array type not Monoid patched")
  })
})

describe("List",function() {
  it("primitives (Array, String) as lists",async ()=>{
    assert(head("oks")==="o","head of string")
    assert(tail("oks")==="ks","tail of string")
    assert(head([1,2,3])===1,"head of Array")
    assert.deepStrictEqual(tail([1,2,3]),[2,3],"Array `tail` error")
  })
})

describe("Functor",function() {
  it("Functor instance of primitive types (Array/String)",async ()=>{
    assert.strictEqual(map(o=>head(o).toUpperCase()+tail(o))("rui"),"RUI","map over string")
    assert.deepStrictEqual(map(o=>o+1)([1,2,3]),[2,3,4],"map over Array")    
    assert.strictEqual(drop(2)("rui"),"i","String drop")
    assert.deepStrictEqual(drop(2)([1,2,3]),[3],"Array drop")    
  })
})

describe("Applicative",function() {
  it("Applicative pure/app",async ()=>{
    assert.deepStrictEqual( [id,id].app([1,2,3]), [1,2],"list applicative")
  })
})

describe("Monad",function() {
  it("Just monad",async ()=>{
    assert.deepStrictEqual( Just(1).when(Just(2)), Just(1),"Just monad << / <* ok")
    assert.deepStrictEqual( Just(1).when(Nothing()), Nothing(),"Just monad << / <* fail")
    assert.deepStrictEqual( Just(1).then(Just(2)), Just(2),"Just monad >> / *> ok")
    assert.deepStrictEqual( Nothing().then(Just(1)), Nothing(),"Just monad >> / *> fail")
    // assert.deepStrictEqual( Nothing.or(Just(1)(), Just(1),"Just alternative <|>")
    assert.deepStrictEqual( Just(1).mbind(x=>Just(x*10)), Just(10),"Just monad >>= (bind)")
  })
  it("Either monad",async ()=>{
    assert.deepStrictEqual( Right(1).when(Right(2)), Right(1),"Either monad << / <* ok")
    assert.deepStrictEqual( Right(1).when(Left(0)), Left(0),"Either monad << / <* fail")
    assert.deepStrictEqual( Right(1).then(Right(2)), Right(2),"Either monad >> / *> ok")
    assert.deepStrictEqual( Left(0).then(Right(1)), Left(0),"Either monad >> / *> fail")
    assert.deepStrictEqual( Right(1).mbind(x=>Right(x*10)), Right(10),"Either monad >>= (bind)")
  })
})

describe("Pair",function() {
  it("tupple functions",async ()=>{
    assert.strictEqual(fst(Pair(1,2)),1)
    assert.strictEqual(snd(Pair(1)(2)),2)
    assert.deepStrictEqual(Pair(1,2).map(o=>o+1),Pair(1,3))
    assert.deepStrictEqual(Pair(1,2).mbind(map(o=>o*2)),Pair(1,4))
  })
})

describe("Maybe",function() {
  it("datatype",async ()=>{
    assert(isMaybe(Just(1)))
    assert(isMaybe(Nothing()))
    assert(isJust(Just(1)))
    assert(isNothing(Nothing()))
    assert(!isJust(Nothing()))
    assert(!isNothing(Just(1)))
    assert.strictEqual(fromJust(Just(1)),1)
  })
})

describe("Either",function() {
  it("datatype",async ()=>{
    assert(isEither(Left("")))
    assert(isEither(Right("")))
    assert(isLeft(Left("")))
    assert(isRight(Right("")))
    assert(!isLeft(Right("")))
    assert(!isRight(Left("")))
    assert.strictEqual(fromLeft(Left(1)),1)
    assert.strictEqual(fromRight(Right(1)),1)
  })
})

describe("Foldable",function() {
  it("primitive and generic folds",async ()=>{
    assert.strictEqual(foldr(a=>b=>a/b)(16)([4,2]),8)//16/(4/2)
    assert.strictEqual(foldl(a=>b=>a/b)(16)([4,2]),2)//(16/4)/2
    assert.strictEqual(foldMap(o=>o.toUpperCase())(["a","b"]),"AB")
    assert.strictEqual(foldr1(a=>b=>a/b)([16,4,2]),8)//16/(4/2)
    assert.strictEqual(foldl1(a=>b=>a/b)([16,4,2]),2)//(16/4)/2
  })
})
