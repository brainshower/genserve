var globals = require('../global/globals');
var logger = require('../global/logger');
var status = require('../global/status');
var dbopen = require('../global/dbopen');
var auth = require('./auth');
var uuid = require('node-uuid');
var crypto = require('crypto');


// Create a user account using a username, password, and email address.
//
exports.createUser = function (req, res) {

    var userRecord = {
        username : req.body.u,
        email : req.body.e,
        password : req.body.p,
    }
    var db = dbopen.getDB();

    logger.log.info('createUser: Creating account for: ' + userRecord.username);

    db.db.collection(globals.col_users, function(err, collection) {
        collection.findOne({username: userRecord.username}, function(err, item) {
            if (item === null) {

                // Good - username is available.  Check email address.
                collection.findOne({email: userRecord.email}, function(err, item) {
                    if (item === null) {

                        // Good - email address is also available.  We're set to create the user.
                        db.db.collection(globals.col_users, function(err, collection) {
                            collection.insert(userRecord, {safe:true}, function(err, result) {
                                if (err || (result === null)) {
                                    res.send(500, status.statusCode(1, 'users', 'Cannot create user record in database.'));
                                } else {
                                    logger.log.info('createUser: Success: ', result[0]);
                                    res.send(result[0]);
                                }
                            });
                        });
                    } // email check
                    else {
                        res.send(500, status.statusCode(2, 'users', 'Email address already exists'));
                    }
               });
            } // username check
            else {
                res.send(500, status.statusCode(3, 'users', 'Username already exists'));
            }
        });
    });
}


// Authenticate a user with a username + password(hash), and return user access token
//
exports.authUser = function(req, res) {

    // Received username and password (SHA256 hashed) from the application.
    var username = req.body.u;
    var password = req.body.p; 
    var db = dbopen.getDB();

    logger.log.info('authUser: Finding user by username on server: ', username);
    db.db.collection(globals.col_users, function(err, collection) {
        collection.findOne({username: username}, function(err, item) {
            if (err || (item === null)) {
                res.send(500, status.statusCode(1, 'users', 'Cannot find username.'))
            }
            else {

                // Check if password hashes match
                if (password !== item.password) {
                    res.send(500, status.statusCode(2, 'users', 'Passwords do not match'));
                }
                else {

                    // Remove any existing session object for this user ID
                    db.db.collection(globals.col_sessions, function(err, collection) {
                        collection.remove({uid: item._id}, function(err, result) {

                            // Create the new session object.
                            var session = {
                                uid : item._id,
                                token : uuid.v4(), // Generate the UUID token
                                expires : new Date(Date.now() + globals.sessionTime), // Expires in 1 hour
                            }

                            // Store session object.
                            db.db.collection(globals.col_sessions, function(err, collection) {
                                collection.insert(session, {safe:true}, function(err, result) {
                                   if (err || (result === null)) {
                                        res.send(500, status.statusCode(3, 'users', 'Could not create session in the database'))
                                    } else {
                                        logger.log.info('authUser: Success: ', result[0]);
                                        res.send(session);
                                    }
                                });
                            });
                        });
                    });
                } // else password check
            } // else can't find username
        });
    });
}


// Reauthenticate user:  Passing in a session object (even if expired token), if it matches as a once-valid session, give a new session
// object in return.  Otherwise delete session object in db.
//
exports.reAuthUser = function(req, res) {

    // Received uid and session token from the application.
    var uid = req.body.uid;
    var token = req.body.token;
    var db = dbopen.getDB();

    logger.log.info('reAuthUser: Reauthenticating session for uid: ', uid);
    db.db.collection(globals.col_sessions, function(err, collection) {
        collection.findOne({token: token}, function(err, item) {
            if (err || (item === null)) {
                logger.log.debug(err, 'reAuthUser: Session token not found (uid, token, db item): ', uid, token, item);
                res.send(500, status.statusCode(1, 'users', 'Session token not be found.'))
            }
            else {

                // Check if user ID's match
                if (uid.toString() !== item.uid.toString()) {
                    logger.log.warn(err, 'reAuthUser: Session token match, but id does not (should not happen) (uid, item)', uid, item);
                    res.send(500, status.statusCode(2, 'users', 'Session token match, but id does not (should not happen)' + uid.toString() + ', ' + item.uid.toString()));
                }
                else {

                    // Remove any existing session object for this token.
                    auth.removeAuth(token).then(
                        function() {

                            // Create the new session object.
                            var session = {
                                uid : uid,
                                token : uuid.v4(), // Generate the UUID token
                                expires : new Date(Date.now() + globals.sessionTime), // Expires in 1 hour
                            }

                            // Store session object.
                            db.db.collection(globals.col_sessions, function(err, collection) {
                                collection.insert(session, {safe:true}, function(err, result) {
                                   if (err || (result === null)) {
                                        res.send(500, status.statusCode(3, 'users', 'Session creation error in database'))
                                    } else {
                                        logger.log.debug('reAuthUser: Successful reauthentication: ', result[0]);
                                        res.send(session);
                                    }
                                });
                            });
                        }
                    );
                } // else uid check
            } // else can't find token
        });
    });
}


// Logout a user by removing their session.  Pass in UID + token.
//
exports.logoutUser = function(req, res) {

    // Received username and password (SHA256 hashed) from the application.
    var uid = req.body.uid;
    var token = req.body.token;
    var db = dbopen.getDB();

    // Remove any existing session object for this user ID.
    db.db.collection(globals.col_sessions, function(err, collection) {
        collection.remove({token: token}, function(err, result) {

            if (err) {
                //res.statusCode = 500; // Don't set an error code.  We don't really care.
                res.send(status.statusCode(1, 'users', 'Session token not found.'));
            }
            else {
                logger.log.info("logoutUser: Session closed for UID ", uid);
                res.send({});
            }
        });
    });
}
