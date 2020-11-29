class Msg {
  constructor(m) {this.msg=m}
  toString() {return this.msg}
  isError() {return false}
}
class Expect extends Msg {}
class Error extends Msg {
  isError() {return true}
}

exports.Msg=Msg
exports.Expect=Expect
exports.Error=Error