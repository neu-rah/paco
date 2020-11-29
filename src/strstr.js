"use strict";

//string stream --------------------------
class StringStream {
  constructor(o) {
    this.lines=o.split('\n')
    this.lines=this.lines.slice(0,-1).map(o=>o+"\n").concat(this.lines.slice(-1))
  }
}

class Cursor {
  constructor(ss,l,c,i) {
    this.str=ss
    this.col=c||0
    this.line=l||0
    this.indent=i&&i.length>0?i:[0]
  }
  setPos(p) {[this.line,this.col]=p;}
  getPos() {return [this.line,this.col];}
  empty() {return this.str==="";}
  head() {
    return (this.str.lines[this.line]&&this.str.lines[this.line][this.col])
  }
  tail() {
    var eol=typeof this.str.lines[this.line][this.col+1]==="undefined"
    return new Cursor(
      this.str,
      this.line+eol?1:0,
      eol?0:this.col+1,
      this.indent
    );
  }
  toString() {
    return this.str.lines[this.line]&&this.str.lines[this.line].substr(this.col)||""
  }
};

const SStr=s=>new Cursor(new StringStream(s))

// exports.StringStream=StringStream
// exports.Cursor=Cursor
exports.SStr=SStr