/*
  Role - Handle all management of user roles
*/

var globals = require('../global/globals');
var logger = require('../global/logger');
var status = require('../global/status');
var dbopen = require('../global/dbopen');
var Q = require('q');

// Relevant collection in the database
var col_roles = "roles";


// Set permissions for a given role.
//
exports.setPermissions = function (role, permGroup, perms) {

    var deferred = Q.defer();
    var db = dbopen.getDB(); 

    // First look for the role to see if it already exists.
    db.db.collection(col_roles, function(err, collection) {
        collection.ensureIndex({name:1},{unique:true});
        collection.findOne({name:role}, function(err, roleObject) {

            var ret = {};

            logger.log.debug("Searched for role name: ", role, ", roleObject returned = ", roleObject, " and err = ", err);

            // Error accessing the database.
            if (err) {
                logger.log.error('setPermissions: Could not access role collection: ',  err);
                ret = status.statusCode(1, 'role', 'Error accessing role collection.');
                deferred.reject(ret);
            }

            // No role exists with this name; need to create it.
            else {
                var newRoleObject;

                if (roleObject === {} || roleObject === undefined || roleObject === null) {
                    // No role exists with this name; need to create it.
                    logger.log.info('setPermissions: Creating new role object: ', role);
                    var newRoleObject = {
                        name : role,
                        permGroups : {},
                    };
                    newRoleObject.permGroups[permGroup] = perms;
                    logger.log.debug('New role object: ',  newRoleObject);
                    db.db.collection(col_roles, function(err, collection) {
                        collection.findAndModify({name:role}, [['_id','asc']], newRoleObject, {upsert: true, safe:true}, function(err, result) {
                            var ret = {};
                            if (err) {
                                logger.log.error('setPermissions: Could not insert new role or update existing role object perm group: ', err);
                                ret = status.statusCode(3, 'role', 'Error updating the perm group');
                                deferred.reject(ret);
                            }
                            else {
                                logger.log.debug('setPermissions: Successfully added role object perms.');
                                ret = status.success('role')
                                deferred.resolve(ret);
                            }
                        });
                    });
                }
                else {
                    // Role exists, so we need to update the perms and store in the database.
                    // Merge in the new perms.
                    logger.log.info('setPermissions: Adding permissions to existing role object');
                    if (roleObject.permGroups.hasOwnProperty(permGroup)) {
                        // Perm group already exists, so need to merge in the new perms.
                        for (var i in perms) { roleObject.permGroups[permGroup][i] = perms[i]; }
                    }
                    else {
                        // No perm group exists, so we'll create it and add the permissions.
                        roleObject.permGroups[permGroup] = perms;
                    }
                    newRoleObject = roleObject;
                    logger.log.debug('New role object: ',  newRoleObject);
                
                    // Push the role object back to the database.
                    db.db.collection(col_roles, function(err, collection) {
                        var upd = {};
                        upd.$set = {};
                        upd.$set["permGroups." + permGroup] = roleObject.permGroups[permGroup];
                        collection.findAndModify({name:role}, [['_id','asc']], upd, {upsert: true, safe:true}, function(err, result) {
                            var ret = {};
                            if (err) {
                                logger.log.error('setPermissions: Could not insert new role or update existing role object perm group: ', err);
                                ret = status.statusCode(3, 'role', 'Error updating the perm group');
                                deferred.reject(ret);
                            }
                            else {
                                logger.log.debug('setPermissions: Successfully added role object perms.');
                                ret = status.success('role')
                                deferred.resolve(ret);
                            }
                        });
                    });
                } // else
            } // else
        });
    });

    return deferred.promise;
}


// Set a user to have a specific role.
// user should be an object with property name "uid" with the user ID, or "username" with the user's name.
//
exports.setUserRole = function (user, role) {

    var db = dbopen.getDB();
    var deferred = Q.defer();

    logger.log.info("setUserRole: Adding role ", role, " for user: ",  user);

    var search = {};
    if (user.hasOwnProperty('uid')) {
        search._id = db.BSON.ObjectID(user.uid);
        logger.log.debug("setUserRole: Searching for user record by UID.");
    }
    else if (user.hasOwnProperty('username')) {
        search.username = user.username;
        logger.log.debug("setUserRole: Searching for user record by username.");
    }
    else {
        logger.log.error("setUserRole: User parameter didn't contain correct field: ", user);
        ret = status.statusCode(1, 'role', 'Error finding user record.');
        deferred.reject(ret);
    }

    // Add the role to the user record.
    db.db.collection(globals.col_users, function(err, collection) {
        collection.findOne(search, function(err, item) {

            var ret = {};
            if (err) {
                logger.log.error('setUserRole: Error accessing user collection: ', err);
                ret = status.statusCode(2, 'role', 'Error accessing user collection.');
                deferred.reject(ret);
            }
            else if (item === undefined || item === null || item === {}) {
                logger.log.error('setUserRole: Error finding user record.');
                ret = status.statusCode(3, 'role', 'Error finding user record.');
                deferred.reject(ret);
            }
            else {

                if (!item.hasOwnProperty('roles')) {
                    item.roles = [];
                    item.roles.push(role);
                } 
                else {
                    // Add the role, but ensure no duplicates
                    var found = false;
                    for (var i = 0; i < item.roles.length; i++) {
                        if (item.roles[i] === role) { found = true; }
                    }
                    if (!found) { item.roles.push(role); }
                }
   
                // Push the user record back to the datbase.
                db.db.collection(globals.col_users, function(err, collection) {
                    collection.update(search, item, {safe:true}, function(err, result) {
                        var ret = {};
                        if (err) {
                            logger.log.error('setUserRole: Could not update user record: ', err);
                            ret = status.statusCode(4, 'role', 'Could not update user record.');
                            deferred.reject(ret);
                        }
                        else {
                            logger.log.debug('setUserRole: Successfully added role to user record.');
                            ret = status.success('role')
                            deferred.resolve(ret);
                        }
                     });
                });

            } // else

        });
    });

    return deferred.promise;
}


// Return the list of all permissions available to a user for a given permission group.
// This will go across all roles.
// user should be an object with property name "uid" with the user ID, or "username" with the user's name.
//
exports.getUserPerms = function(user, permGroup) {

    var db = dbopen.getDB();
    var deferred = Q.defer();

    logger.log.info("getUserParms: Getting permGroups for user.");

    var search = {};
    if (user.hasOwnProperty('uid')) {
        search._id = db.BSON.ObjectID(user.uid);
        logger.log.debug("getUserParms: Searching for user record by UID.");
    }
    else if (user.hasOwnProperty('username')) {
        search.username = user.username;
        logger.log.debug("getUserParms: Searching for user record by username.");
    }
    else {
        logger.log.error("getUserParms: User parameter didn't contain correct field: ", user);
    }

    // Get the user record.
    db.db.collection(globals.col_users, function(err, collection) {
        collection.findOne(search, function(err, urecord) {

            var ret = {};
            if (err) {
                logger.log.error('getUserPerms: Error accessing user collection: ', err);
                ret = status.statusCode(1, 'role', 'Error accessing user collection.');
                deferred.reject(ret);
            }
            else if (urecord === undefined || urecord === null || urecord === {}) {
                logger.log.error('getUserPerms: User not found: ', urecord);
                ret = status.statusCode(2, 'role', 'User not found.');
                deferred.reject(ret);
            }
            else {

                // Load all the role objects for the role(s) this user is assigned.
                logger.log.debug("urecord = ", urecord);
                var roles = [];
                if (urecord.hasOwnProperty('roles')) {
                    roles = urecord.roles;
                }
                logger.log.debug("roles = ", roles);

               db.db.collection(col_roles, function(err, collection) {
                   collection.find({name: {$in:roles}}).toArray(function(err, items) {
                       logger.log.debug("err = ", err);
                       logger.log.debug("role records = ", items);
                       var perms = mergeRolePerms(items, permGroup);
                       logger.log.debug("Merged perms = ", perms);
                       //var userRoleRecs = items.toArray();
                       //logger.log.debug("role records = ", userRoleRecs);
                   });
               });  


            }

            deferred.resolve({});
        });
    });

    return deferred.promise;
}



// Passing in an array of role objects, return an array of merged permission groups with permissions.
//
var mergeRolePerms = function (roleArray, permGroup) {

    var mergedPerms = [];

    for (var i = 0; i < roleArray.length; i++) {

        var pgs = roleArray[i].permGroups;

        if (pgs.hasOwnProperty(permGroup)) {
            logger.log.debug("Looping within permGroup ", permGroup, " = \n", pgs[permGroup]);
            for (var perm in pgs[permGroup]) {
                logger.log.debug("perm ", perm, " = ", pgs[permGroup][perm]);
                // If the perm doesn't exist in our merged list, just add it.
                if (!mergedPerms.hasOwnProperty(perm)) {
                    mergedPerms[perm] = pgs[permGroup][perm];
                }
                // Otherwise if the perm is already truthy, keep it, else use the new value.  Effectively a logical OR.
                else {
                    mergedPerms[perm] = mergedPerms[perm] ? mergedPerms[perm] : pgs[permGroup][perm];
                }
            }
        }
    }

    return mergedPerms;
}

