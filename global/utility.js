/*

Utility functions

*/

// Currying function: create a new function by fixing an argument.  
// See https://medium.com/@kbrainwave/currying-in-javascript-ce6da2d324fe
//
exports.curry = function (fn) {
	var args = Array.prototype.slice.call(arguments, 1);

	return function() {
		return fn.apply(this, args.concat(
			Array.prototype.slice.call(arguments, 0)));
	};
};

