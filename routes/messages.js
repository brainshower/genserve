var globals = require('../global/globals');
var dbopen = require('../global/dbopen');
var dbserve = require('./dbserve');

// Relevant database and collection
var col = 'messages';

// Open the database & collection
var db = dbopen.openDB(globals.dbname);

// Curry the base functions to create new functions using the specific collection.
// 
exports.findById = dbserve.findById.bind(undefined, db, col);
exports.findAll = dbserve.findAll.bind(undefined, db, col);
exports.addItem = dbserve.addItem.bind(undefined, db, col);
exports.updateItem = dbserve.updateItem.bind(undefined, db, col);
exports.deleteItem = dbserve.deleteItem.bind(undefined, db, col);
