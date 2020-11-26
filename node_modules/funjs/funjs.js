"use strict";
//should be available throwgh Monoid also
// const {append,semigroupFunction,semigroupString,semigroupArray}=require("./src/Semigroup")
// semigroupFunction(Function().__proto__)
// semigroupString(String().__proto__)
// semigroupArray(Array().__proto__)

const func=require("./src/Functional")
const {id,fcomp,fchain,constant,flip,cons}=func

const monoid=require("./src/Monoid")
const {empty,append,mconcat,monoidFunction,monoidString,monoidArray}=monoid
monoidFunction(Function().__proto__)
monoidString(String().__proto__)
monoidArray(Array().__proto__)

const list=require("./src/List")
const {head,tail,listString,listArray}=list
listString(String().__proto__)
listArray(Array().__proto__)

const functor=require("./src/Functor")
const {map,drop}=functor

const applicative=require("./src/Applicative")
const {pure,app}=applicative

const monad=require("./src/Monad")
const {/*pure,*/mbind}=monad

const pair=require("./src/Pair")
const {Pair,fst,snd}=pair

const maybe=require("./src/Maybe")
const {Maybe,isMaybe,Nothing,isNothing,Just,isJust,fromJust}=maybe

const either=require("./src/Either")
const {isEither,Left,isLeft,fromLeft,Right,isRight,fromRight}=either

const fold=require("./src/Foldable")
const {foldable,foldr,foldl,foldr1,foldl1,foldMap}=fold
foldable(String().__proto__)
foldable(Array().__proto__)

exports.patchPrimitives=function(f,s,a) {
  //patch primitive data types for Monoid (and Semigroup)
  monoidFunction(f)
  monoidString(s)
  monoidArray(a)

  //patch primitive data types for List
  listString(s)
  listArray(a)

  //patch primitive data types for Foldable
  foldable(s)
  foldable(a)
}


//republish imported modules
const pub=o=>Object.keys(o).forEach(k=>exports[k]=o[k])

pub(func)
pub(monoid)
pub(list)
pub(functor)
pub(pair)
pub(maybe)
pub(either)
pub(fold)
pub(monad)
pub(app)