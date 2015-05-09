var assert = require('./assert');
var parser = require('./parser');
var generator = require('./generate');


// Attempts to prove two grammars are different through the magic of fuzzing.
// If it finds a string s which is accepted by one but not the other,
// returns {string: s, acceptedByFirst: boolean} (acceptedByFirst is true if A accepts
// and B rejects, false if A rejects and B accepts. In other cases s is not a witness
// to A and B being different.
// If no witness is found, returns false. (So you can use this in an `if` if you don't
// care what the witness is.)
// 'count' and 'length' are optional parameters specifying how many strings at each
// length to check and the maximum length of strings to check respectively.
// Default count is 10 and length is 20.
// Ends up wasting some time generating duplicates at low lengths, but whatever.
// TODO: for efficiency, should use the ftables from generator to limit how count at
// a given length
function locatableDifference(A, B, count, length) {
  count = count || 10;
  length = length || 20;
  if(length < 0 || count < 1) return false;
  
  var oldProduceCount = parser.PRODUCECOUNT;
  parser.PRODUCECOUNT = parser.PRODUCEONE;
  
  function witness(s, which) {
    parser.PRODUCECOUNT = oldProduceCount; // found a witness: done, so reset. yeah, probably shouldn't go here.
    return {string: s, acceptedByFirst: which};
  }
  
  var genA = generator(A);
  var genB = generator(B);
  
  for(var n=8; n<length; ++n) {
    // first, check that they both either do or do not produce any strings of this length
    var a = genA(n);
    var b = genB(n);
    if(a === null && b === null) {
      continue; // not gonna get any strings; move on.
    }
    else if(a !== null && b === null) {
      assert(parser.parse(A, a).length === 1, 'Generated a string "' + a + '" which did not parse.');
      return witness(a, true);
    }
    else if(a === null && b !== null) {
      assert(parser.parse(B, b).length === 1, 'Generated a string "' + b + '" which did not parse.');
      return witness(b, false);
    }
    // ok, at least some strings in each.
    // strictly speaking, could compare a and b here, but whatever.
    for(var i=0; i<count; ++i) {
      a = genA(n);
      if(parser.parse(B, a).length !== 1) {
        return witness(a, true);
      }
      
      b = genB(n);
      if(parser.parse(A, b).length !== 1) {
        return witness(b, true);
      }
    }
  }
  
  parser.PRODUCECOUNT = oldProduceCount;
  return false;
}


module.exports = {
  locatableDifference: locatableDifference
}