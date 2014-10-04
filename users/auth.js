/*
  This module handles the authentication of a user via a passed in UID + session token (previously given to the client).

*/

// Required modules
var globals = require('../global/globals');
var logger = require('../global/logger');
var status = require('../global/status');
var dbopen = require('../global/dbopen');
var moment = require('moment');
var Q = require('q');


// Authenticate a user with a UID + access token. Return undefined if authenticated, or error object if otherwise.
//
exports.auth = function(uid, token) {

    var deferred = Q.defer();
    var db = dbopen.getDB();

    logger.log.info('auth: Finding session by token: ' + token);
    db.db.collection(globals.col_sessions, function(err, collection) {
        collection.findOne({token: token}, function(err, item) {

            var errStatus = undefined;

            // Check if token found
            if (!err && item !== null) {

                // Check if UID match
                if (item.uid == uid) {

                    // Check if the token is still valid
                    var now = moment.utc(new Date(Date.now())).toString();
                    var sessionExpTime = moment.utc(new Date(item.expires)).toString();
                    logger.log.debug("auth: Now vs. session expiration is: ", now, sessionExpTime);

                    if (now < sessionExpTime) {
                        // Token is still valid!  Resolve that we're good.
                        logger.log.debug("auth: Token is valid!");
                        deferred.resolve({});
                    }
                    else {
                        errStatus = status.statusCode(3, status.STATUS_TYPE_AUTH, 'session token expired');
                    }
                }
                else {
                    errStatus = status.statusCode(2, status.STATUS_TYPE_AUTH, 'session found but UID does not match');
                }
            }
            else {
                errStatus = status.statusCode(1, status.STATUS_TYPE_AUTH, 'cannot find session token');
            }

            deferred.reject(errStatus);

        });
    });

    return deferred.promise;
}


// Remove session from database
//
exports.removeAuth = function (token) {

    var deferred = Q.defer();
    var db = dbopen.getDB();

    db.db.collection(globals.col_sessions, function(err, collection) {
        collection.remove({token: token}, function(err, result) {
            // If there's an error removing the session object, screw it. Just log it.
            if (err) {
               logger.log.info(err, "auth: Cannot remove session object. Session token: ", token);
            }
            deferred.resolve({});
        });
    });

    return deferred.promise;
}
