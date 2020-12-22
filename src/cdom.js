"use strict";

const {clog}=require("./debug");

//character domains
//by neu-rah Dec.2020

var it=exports?global:this
if(!exports) var exports={}

Object.assign(it,require("./debug"))
Object.assign(it,require("rsite-funjs"))
patchPrimitives(
  Function().__proto__,
  String().__proto__,
  Array().__proto__,
  Object().__proto__,
)

const prev=o=>String.fromCharCode(o.charCodeAt(0)-1)
const next=o=>String.fromCharCode(o.charCodeAt(0)+1)

const simplify=n=>o=>o.simplify(n)

class Nil{}

const CDom=(O=Nil)=>class CDom extends O {
  toString() {return "«cdom»"}
  isEmpty() {return false}
  simpl() {return Nothing()}
  join(o) {return Nothing()}
  int(o) {return Nothing()}
  simplify(hist=[]) {
    const r=this.simpl()
    return isNothing(r)?
      cons(this,hist):
      r.mbind(simplify(cons(this,hist)))
  }
  union(o) {return fromJust(this._union(o).or(Just(union(this,o))))}
  _union(o) {
    switch(o.constructor) {
      case None: return Just(this)
      case Any: return Just(any)
      case Union: return o.join(this)
      default: return this.join(o).or(o.join(this))
    }
  }
  intersect(o) {return fromJust(this._intersect(o)/*.or(Just(none))*/)}
  _intersect(o) {
    switch(o.constructor) {
      case None: return Just(none)
      case Any: return Just(o)
      case Union: return o.int(this)
      default: return this.int(o).or(o.int(this)).or(Just(none))
    }
  }
}

class None extends CDom() {
  isEmpty() {return true}
  toString() {return "∅"}
  has(o)  {return false}
  join(o) {return Just(o)}
  int(o) {return Just(none)}
} const none=new None()

class Any extends CDom() {
  toString() {return "𝕌"}
  has(o)  {return true}
  join(o) {return Just(any)}
  int(o) {return Just(o)}
} const any=new Any()

class Point extends CDom() {//just for commom methods...
  constructor(at) {super();this.at=at}
}//we will not instantiate this

class LT extends CDom(Point) {
  toString() {return "..]"+this.at}
  has(o)  {return o<this.at}
  join(o) {return o.constructor===LT?Just(this.has(o.at)?this:o):Nothing()}
  int(o) {return o.constructor===LT?Just(lt(Math.min(this.at,o.at))):Nothing()}
} const lt=o=>new LT(o)

class GT extends CDom(Point) {
  toString() {return this.at+"[.."}
  has(o)  {return o>this.at}
  join(o) {
    switch(o.constructor) {
      case LT: 
        if(o.has(this.at)) return Just(any)
        break
      case GT: return Just(this.has(o.at)?this:o)
    }
    return Nothing()
  }
  int(o) {
    switch(o.constructor) {
      case LT: 
        if(o.has(this.at)) return Just(range(this.at,o.at))
        break
      case GT: return Just(gt(Math.max(this.at,o.at)))
    }
    return Nothing()
  }
} const gt=o=>new GT(o)

class Range extends CDom(PairClass) {
  toString() {return "["+this.fst()+"-"+this.snd()+"]"}
  has(c) {return this.fst()<=c&&c<=this.snd()}
  join(o) {
    switch(o.constructor) {
      case LT:
        if(o.has(this.snd())) return Just(o)
        if(o.has(this.fst())) return Just(lt(this.snd()))
        break
      case GT:
        if(o.has(this.fst())) return Just(o)
        if(o.has(this.snd())) return Just(gt(this.fst()))
        break
      case Range:
        if(this.snd()===prev(o.fst())) return Just(range(this.fst(),o.snd()))//adjacent
        if(this.has(o.fst())) {
          if(this.has(o.snd())) return Just(this)
          return Just(range(this.fst(),o.snd()))
        }
        if(this.has(o.snd())) return Just(range(o.fst(),this.snd()))
        break
    }
    return Nothing()
  }
  int(o) {
    switch(o.constructor) {
      case LT:
        if(o.has(this.snd())) return Just(this)
        if(o.has(this.fst())) return Just(range(this.fst(),o.at))
        break
      case GT:
        if(o.has(this.fst())) return Just(this)
        if(o.has(this.snd())) return Just(range(o.at,this.snd()))
        break
      case Range:
        if(this.has(o.fst())) {
          if(this.has(o.snd())) return Just(o)
          return Just(range(o.fst(),this.snd()))
        }
        if(this.has(o.snd())) return Just(range(this.fst(),o.snd()))
        break
    }
    return Nothing()
  }
  simpl() {return this.fst()>this.snd()?Just(none):Nothing()}
} const range=(a,z)=>new Range(a,z)

class SetOp extends CDom() {
  _dist(o) {
    return new this.constructor(...this.ranges.map(x=>this.cc()(o,x)))
  }
  // a ∩ (b ∪ c) ⇒ (a ∩ b) ∪ (a ∩ c)
  // a ∪ (b ∩ c) ⇒ (a ∪ b) ∩ (a ∪ c)
  dist(o) {//distribute `o` over this with some caution
    if (this.ranges.findIndex(x=>isJust(x._intersect(o)))===-1) return Nothing()
    //if they have something in common:
    return Just(this._dist(o))
  }
}

class Union extends SetOp {
  constructor(...oo) {
    super()
    this.ranges=oo
  }
  toString() {
    if(this.ranges.length===0) return ["(∅)"]
    return this.ranges.map(
    o=>(o.constructor===Union||o.constructor===Intersect||this.ranges.length<2)?
      "("+o.toString()+")":
      o.toString()
    ).join(" ∪ ")
  }
  cc() {return intersect}
  has(c) {return this.fst().foldr(i=>o=>i.has(c)||o)(false)}
  union(o) {
    return o.constructor===Union?
      union(...(this.ranges.concat(o.ranges))):
      union(...this.ranges,o)
  }
  simpl() {
    //empty
    if(this.ranges.length===0) return Just(none)

    //single selector
    if(this.ranges.length===1) return Just(this.ranges.head())

    //neutral elements
    const fn=this.ranges.filter(x=>x.constructor!==None)
    if(fn.length!==this.ranges.length) return Just(fn.length===0?none:fn.length===1?fn[0]:union(...fn))

    //un-nest
    if(this.ranges.find(i=>i.constructor===Union))
      return Just(union(...this.ranges.foldr(i=>o=>o.concat(i.constructor===Union?i.ranges:[i]))([])))

    // simplify members
    const p=this.ranges
      .zipWith(a=>b=>Pair(a.simpl(),b))(this.ranges)
      .partition(fcomp(isJust,fst))
    if(p.fst().length)
      return Just(union(...p.fst().map(fcomp(fromJust,fst)).append(p.snd().map(snd))))
    
    //join all
    const o=this.ranges.head()
    const oo=this.ranges.tail()
    for(var i=0;i<oo.length;i++) {
      const r=o._union(oo[i])
      if(isJust(r)) return Just(union(...oo.slice(0,i),fromJust(r),...oo.slice(i+1)))
    }

    //distribute
    const di=this.ranges.findIndex(i=>i.constructor===Intersect)
    if(di!==-1) {
      const cdi=this.ranges[di].dist(union(this.ranges.slice(0,di).concat(this.ranges.slice(di+1))))
      if (isJust(cdi)) return cdi
    }

    return Nothing()
  }
} const union=(...oo)=>new Union(...oo)

class Intersect extends SetOp {
  constructor(...oo) {
    super()
    this.ranges=oo
  }
  toString() {return this.ranges.map(
    o=>(o.constructor===Union||o.constructor===Intersect||this.ranges.length<2)?
      "("+o.toString()+")":
      o.toString()
  ).join(" ∩ ")}
  cc() {return union}
  has(c) {return this.fst().foldr(i=>o=>i.has(c)||o)(false)}
  intersect(o) {
    return o.constructor===Intersect?
      union(...(this.ranges.concat(o.ranges))):
      union(...this.ranges,o)
  }
  simpl() {
    // empty
    if(this.ranges.length===0) return Just(none)

    //single selector
    if(this.ranges.length===1) return Just(this.ranges.head())

    //neutral elements
    const fn=this.ranges.filter(x=>x.constructor!==Any)
    if(fn.length!==this.ranges.length) return Just(fn.length===0?any:fn.length===1?fn[0]:intersect(...fn))

    //un-nest
    if(this.ranges.find(i=>i.constructor===Intersect))
      return Just(union(...this.ranges.foldr(i=>o=>o.concat(i.constructor===Union?i.ranges:[i]))([])))

    // simplify members
    const p=this.ranges
      .zipWith(a=>b=>Pair(a.simpl(),b))(this.ranges)
      .partition(fcomp(isJust,fst))
    if(p.fst().length)
      return Just(intersect(...p.fst().map(fcomp(fromJust,fst)).append(p.snd().map(snd))))
    
    //join all
    const o=this.ranges.head()
    const oo=this.ranges.tail()
    for(var i=0;i<oo.length;i++) {
      const r=o._intersect(oo[i])
      if(isJust(r)) return Just(intersect(...oo.slice(0,i),fromJust(r),...oo.slice(i+1)))
    }

    //distribute
    const di=this.ranges.findIndex(i=>i.constructor===Union)
    if(di!==-1) {
      const cdi=this.ranges[di].dist( intersect(...this.ranges.slice(0,di).concat(this.ranges.slice(di+1))).simplify().head() )
      if (isJust(cdi)) return cdi
    }

    return Nothing()
  }
} const intersect=(...oo)=>new Intersect(...oo)

// exports.CDom=CDom
exports.none=none
exports.any=any
exports.lt=lt
exports.gt=gt
exports.range=range
exports.union=union
exports.intersect=intersect
exports.prev=prev
exports.next=next
exports.simplify=simplify

// const d=range('0','9')
// const hl=range('a','f')
// const e=range('e','i')
// const lt4=lt('4')
// const r=union(lt4,gt('a'),union(d,lt(' ')))
// const i=intersect(hl,e)
// const l=range('a','z')

// const t=intersect(d,union(range('4','4'),range('6','6')))

// clog(t.simplify().reverse().map(o=>o.toString()).join(" ⇔ "))

// const a=intersect(d,union(lt('k'),range('l','v'),range('x','x'),gt('y')))
// const a=union(d,intersect(d))
// const r=a.simplify()
// clog(r.reverse().map(x=>x+"").join(" <=> "))