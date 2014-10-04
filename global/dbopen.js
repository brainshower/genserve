// Open a mongo database and collection
//
var logger = require('./logger');
var Q = require('q');

var dbObject = undefined;

exports.openDB = function (dbname) {

    var deferred = Q.defer();

    var mongo = require('mongodb');
    var Server = mongo.Server,
        Db = mongo.Db,
        BSON = mongo.BSONPure;
    var server = new Server('localhost', 27017, {auto_reconnect: true});
    var db = new Db(dbname, server);

    db.open(function(err, db) {
        if(err) {
            logger.log.warn("openDB: Unable to open database: ", dbname);
            deferred.reject(dbObject);
        }
        else {
            logger.log.debug("openDB: Database opened: ", dbname);
            dbObject = {db : db, BSON : BSON};
            deferred.resolve(dbObject);
        }
    });

    return deferred.promise;
}


// Return the database object - should be used only after the DB is first opened.
//
exports.getDB = function () {
    
    if (dbObject === undefined) {
        logger.log.error("dbopen: getDB is returning an undefined database object.");
    }
    return dbObject;
}

