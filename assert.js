module.exports = function(condition, message) {
  if(!condition) {
    throw new Error(message);
  }
}
