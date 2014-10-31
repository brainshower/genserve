/*
  Role - Handle all management of user roles
*/

var globals = require('../global/globals');
var logger = require('../global/logger');
var status = require('../global/status');
var dbopen = require('../global/dbopen');
var _ = require('lodash');
var Q = require('q');

// Relevant collection in the database
var col_roles = "roles";


// Registry of all permissions
var permissions_registry = {};


// Mirror of roles, perm groups, and permissions.  This is kept as a read cache for quick permission checks by
// other entities.
var role_database = {};


// Create the default permissions group object that will be used
// when new roles are created.  All permissions initialized to false.
//
var createDefaultPermGroups = function() {

    var permGroups = {};

    for (var permGroup in permissions_registry) {
        if (permissions_registry.hasOwnProperty(permGroup)) {
            permGroups[permGroup] = {};
            var perms = permissions_registry[permGroup];
            for (var i = 0; i < perms.length; i++) {
                var perm = perms[i];
                permGroups[permGroup][perm] = false;
            }
        }
    }
    return permGroups;
}


// Name of default role for all non-logged-in users.
exports.ROLE_ANONYMOUS = "anonymous";
// Name of default role for all new users.
exports.ROLE_AUTHENTICATED = "authenticated";
// Name of the role above every other role: the admin.
exports.ROLE_ADMIN = "admin";


// Perform any initialization when the server starts up.
exports.init = function() {

    var deferred = Q.defer();

    // Look for a the anonymous role in the database.
    exports.getAllRoles().then(
        function(roles) {
            predicate(roles, exports.ROLE_ANONYMOUS, function(err) {
                if (!err) {
                    predicate(roles, exports.ROLE_ADMIN, function(err) {
                        if (!err) {
                            predicate(roles, exports.ROLE_AUTHENTICATED, function(err) {
                                if (!err) {
                                    deferred.resolve({});
                                }
                                else {
                                    deferred.reject({});
                                }
                            });
                        } 
                        else {
                            deferred.reject({});
                        }
                    });
                }
                else {
                    deferred.reject({});
                }
            });
        }, 
        function (fail) {
            // Could not fetch roles.  Error, exit.
            deferred.reject({});
        }
    );

    var predicate = function(roles, role, callback) {
        var found = _.find(roles, {name: role});

        // If no anonymous role is found in the database, create it as a system role.
        if (!found) {
            exports.createRole(role, true).then(
                function(success) {
                    if (callback) { callback(false); }
                },
                function(error) {
                    if (callback) { callback(true); }
                }
            );
        }
        else { 
             // It exists, so we're done with this role.
            callback (false);
        }
    }

    return deferred.promise;
}


// Register the permissions group and associated permissions (array).
// This is called by any entity upon initialization that has permission.
//
exports.registerPermissions = function(permGroup, perms) {
    permissions_registry[permGroup] = perms;
}


// Create a new role.  If system = true, the role cannot be deleted (system role).
//
exports.createRole = function (roleName, system) {

    var newRoleObject;
    var db = dbopen.getDB();
    var deferred = Q.defer();

    logger.log.info('createRole: Creating new role object: ', roleName);
    var systemRole = system ? true : false;
    var newRoleObject = {
        name : roleName,
        permGroups : createDefaultPermGroups(),
        system : systemRole,
    };

    db.db.collection(col_roles, function(err, collection) {
        collection.insert(newRoleObject, {safe:true}, function(err, result) {
            var ret = {};
            if (err) {
                logger.log.error('createRole: Could not insert new role: ', err);
                ret = status.statusCode(1, 'role', 'Error inserting new role');
                deferred.reject(ret);
            }
            else {
                logger.log.debug('createRole: Successfully added new role object.');
                ret = status.success('role');
                // Update the local role cache
                exports.getAllRoles().then(
                    function() {
                        deferred.resolve(ret);
                    }
                );
            }
        });
    });

    return deferred.promise;
}


// Delete a new role
//
exports.deleteRole = function (roleName) {

    var db = dbopen.getDB();
    var deferred = Q.defer();

    logger.log.info('deleteRole: Deleting role object: ', roleName);

    // First check if the role is a system role.
    var role = _.find(role_database, {name: roleName});
    if (role.system) {
        return null;
    }
    else {
        // Remove the role
        db.db.collection(col_roles, function(err, collection) {
            collection.remove({name: roleName}, {safe:true}, function(err, result) {
                var ret = {};
                if (err) {
                    logger.log.error('deleteRole: Could not delete role: ', err);
                    ret = status.statusCode(1, 'role', 'Error deleting role');
                    deferred.reject(ret);
                }
                else {
                    logger.log.debug('deleteRole: Successfully deleted role object.');
                    ret = status.success('role')
                    // Update the local role cache
                    exports.getAllRoles().then(
                        function() {
                            deferred.resolve(ret);
                        }
                    );
                }
            });
        });
    
        return deferred.promise;
    }
}


// Create a new permissions group
//
exports.createPermGroup = function (roleName, permGroupName) {

    var db = dbopen.getDB();
    var deferred = Q.defer();
    var upd = {};
    upd.$set = {};
    upd.$set["permGroups." + permGroupName] = {};

    logger.log.info('createPermGroup: Creating new permissions group (role, pg): ', roleName, permGroupName);

    db.db.collection(col_roles, function(err, collection) {
        collection.findAndModify({name: roleName}, [['_id','asc']], upd, {upsert: true, safe:true}, function(err, result) {
            var ret = {};
            if (err) {
                logger.log.error('createPermGroup: Could not insert new perm group: ', err);
                ret = status.statusCode(1, 'role', 'Error inserting new perm group');
                deferred.reject(ret);
            }
            else {
                logger.log.debug('createPermGroup: Successfully added new perm group.');
                ret = status.success('role')
                // Update the local role cache
                exports.getAllRoles().then(
                    function() {
                        deferred.resolve(ret);
                    }
                );
            }
        });
    });

    return deferred.promise;
}


// Delete a perm group
//
exports.deletePermGroup = function (roleName, permGroupName) {

    var db = dbopen.getDB();
    var deferred = Q.defer();
    var upd = {};
    upd.$unset = {};
    upd.$unset["permGroups." + permGroupName] = "";

    logger.log.info('deletePermGroup: Deleting perm group (role, pg): ', roleName, permGroupName);

    db.db.collection(col_roles, function(err, collection) {
        collection.findAndModify({name: roleName}, [['_id','asc']], upd, {safe:true}, function(err, result) {
            var ret = {};
            if (err) {
                logger.log.error('deletePermGroup: Could not delete perm group: ', err);
                ret = status.statusCode(1, 'role', 'Error deleting perm group');
                deferred.reject(ret);
            }
            else {
                logger.log.debug('deletePermGroup: Successfully deleted perm group.');
                ret = status.success('role')
                // Update the local role cache
                exports.getAllRoles().then(
                    function() {
                        deferred.resolve(ret);
                    }
                );
            }
        });
    });

    return deferred.promise;
}


// Get all the roles available.  Returns an array of all role objects.
//
exports.getAllRoles = function () {

    var db = dbopen.getDB();
    var deferred = Q.defer();

    logger.log.info("getAllRoles:");

    // First look for the role to see if it already exists.
    db.db.collection(col_roles, function(err, collection) {
        collection.find({}, {sort: "name"}).toArray(function(err, items) {
            if (err) {
                var ret = status.statusCode(1, 'role', 'Error acccessing role collection.');
                deferred.reject(ret);
            } 
            else {
                role_database = items; // update the local version of the roles / permissions
                deferred.resolve(items);
                /* Uncomment if you want to just return the role names 
                var roles = [];
                for (i = 0; i < items.length; i++) {
                    if (items[i].hasOwnProperty('name')) { 
                        roles.push(items[i].name);
                    }
                }
                deferred.resolve(roles);
                */
            }
        });
    });

    return deferred.promise;
}


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
                        permGroups : createDefaultPermGroups(),
                        system : false,
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
                                ret = status.success('role');
                                // Success.  Now before exiting, force a reload of the roles & permissions to update the cache.
                                exports.getAllRoles().then(
                                    function() {
                                        deferred.resolve(ret);
                                    }
                                );
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
                                ret = status.success('role');
                                exports.getAllRoles().then(
                                    function() {
                                        deferred.resolve(ret);
                                    }
                                );
                            }
                        });
                    });
                } // else
            } // else
        });
    });

    return deferred.promise;
}


// Delete a permission from a role and permission group. 
//
exports.deletePermission = function (roleName, permGroupName, permName) {

    var db = dbopen.getDB();
    var deferred = Q.defer();

    var upd = {};
    upd.$unset = {};
    upd.$unset["permGroups." + permGroupName + "." + permName] = "";

    logger.log.info('deletePermssion: Deleting perm (role, pg, perm): ', roleName, permGroupName, permName);

    db.db.collection(col_roles, function(err, collection) {
        collection.findAndModify({name: roleName}, [['_id','asc']], upd, {safe:true}, function(err, result) {
            var ret = {};
            if (err) {
                logger.log.error('deletePermssion: Could not delete permission: ', err);
                ret = status.statusCode(1, 'role', 'Error deleting permission');
                deferred.reject(ret);
            }
            else {
                logger.log.debug('deletePermission: Successfully deleted permission.');
                ret = status.success('role');
                // Update local role cache object
                exports.getAllRoles().then(
                    function() {
                        deferred.resolve(ret);
                    }
                );
            }
        });
    });

    return deferred.promise;
}


// Get the roles assigned to a single user.
//
exports.getUserRoles = function (user) {

    var db = dbopen.getDB();
    var deferred = Q.defer();

    logger.log.info("getUserRoles: Getting all roles for user: ",  user);

    var search = {};
    if (user.hasOwnProperty('uid')) {
        search._id = db.BSON.ObjectID(user.uid);
        logger.log.debug("getUserRoles: Searching for user record by UID.");
    }
    else if (user.hasOwnProperty('username')) {
        search.username = user.username;
        logger.log.debug("getUserRoles: Searching for user record by username.");
    }
    else {
        logger.log.error("getUserRoles: User parameter didn't contain correct field: ", user);
        ret = status.statusCode(1, 'role', 'Error finding user record.');
        deferred.reject(ret);
    }

    // Add the role to the user record.
    db.db.collection(globals.col_users, function(err, collection) {
        collection.findOne(search, function(err, item) {

            var ret = {};
            if (err) {
                logger.log.error('getUserRoles: Error accessing user collection: ', err);
                ret = status.statusCode(2, 'role', 'Error accessing user collection.');
                deferred.reject(ret);
            }
            else if (item === undefined || item === null || item === {}) {
                logger.log.error('getUserRoles: Error finding user record.');
                ret = status.statusCode(3, 'role', 'Error finding user record.');
                deferred.reject(ret);
            }
            else {
                if (!item.hasOwnProperty('roles')) {
                    deferred.resolve([]);
                }
                else {
                    deferred.resolve(item.roles);
                }
            } // else
        });
    });

    return deferred.promise;
}


// Get all users and their associated roles
//
exports.getUsersAndRoles = function() {

    var db = dbopen.getDB();
    var deferred = Q.defer();

    logger.log.info("getUsersAndRoles: Getting all users and their associated roles.");

    db.db.collection(globals.col_users, function(err, collection) {
        collection.find({},{sort: "username"}).toArray(function(err, items) {

            var ret = {};
            if (err) {
                logger.log.error('getUsersAndRoles: Error accessing user collection: ', err);
                ret = status.statusCode(2, 'role', 'Error accessing user collection.');
                deferred.reject(ret);
            }
            else if (items === undefined || items === null || items === {}) {
                logger.log.error('getUsersAndRoles: Error finding user record.');
                ret = status.statusCode(3, 'role', 'Error finding user record.');
                deferred.reject(ret);
            }
            else {
                var usersAndRoles = [];
                for (i = 0; i < items.length; i++) {
                    var user = {};
                    user.uid = items[i]._id;
                    user.username = items[i].username;
                    if (items[i].hasOwnProperty('roles')) {
                        user.roles = items[i].roles;
                    }
                    usersAndRoles.push(user);
                }
                deferred.resolve(usersAndRoles);

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


// Remove a role from a specific user.
// user should be an object with property name "uid" with the user ID, or "username" with the user's name.
//
exports.removeUserRole = function (user, role) {

    var db = dbopen.getDB();
    var deferred = Q.defer();

    logger.log.info("removeUserRole: Remove role ", role, " for user: ",  user);

    var search = {};
    if (user.hasOwnProperty('uid')) {
        search._id = db.BSON.ObjectID(user.uid);
        logger.log.debug("removeUserRole: Searching for user record by UID.");
    }
    else if (user.hasOwnProperty('username')) {
        search.username = user.username;
        logger.log.debug("removeUserRole: Searching for user record by username.");
    }
    else {
        logger.log.error("removeUserRole: User parameter didn't contain correct field: ", user);
        ret = status.statusCode(1, 'role', 'Error finding user record.');
        deferred.reject(ret);
    }

    // Get the user record.
    db.db.collection(globals.col_users, function(err, collection) {
        collection.findOne(search, function(err, item) {

            var ret = {};
            if (err) {
                logger.log.error('removeUserRole: Error accessing user collection: ', err);
                ret = status.statusCode(2, 'role', 'Error accessing user collection.');
                deferred.reject(ret);
            }
            else if (item === undefined || item === null || item === {}) {
                logger.log.error('removeUserRole: Error finding user record.');
                ret = status.statusCode(3, 'role', 'Error finding user record.');
                deferred.reject(ret);
            }
            else {

                if (!item.hasOwnProperty('roles')) {
                    logger.log.debug('removeUserRole: User does not have any roles, so could not remove. Still OK.');
                    ret = status.success('role')
                    deferred.resolve(ret);
                } 

                // Remove the role, if it happens to exist.
                item.roles = _.without(item.roles, role);
   
                // Push the user record back to the datbase.
                db.db.collection(globals.col_users, function(err, collection) {
                    collection.update(search, item, {safe:true}, function(err, result) {
                        var ret = {};
                        if (err) {
                            logger.log.error('removeUserRole: Could not update user record: ', err);
                            ret = status.statusCode(4, 'role', 'Could not update user record.');
                            deferred.reject(ret);
                        }
                        else {
                            logger.log.debug('removeUserRole: Successfully removed role from user record.');
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

    logger.log.info("getUserPerms: Getting permGroups for permission group: ", permGroup);

    var search = {};
    if (user.hasOwnProperty('uid')) {
        search._id = db.BSON.ObjectID(user.uid);
        logger.log.debug("getUserPerms: Searching for user record by UID.");
    }
    else if (user.hasOwnProperty('username')) {
        search.username = user.username;
        logger.log.debug("getUserPerms: Searching for user record by username.");
    }
    else {
        logger.log.error("getUserPerms: User parameter didn't contain correct field: ", user);
    }

    // Get the user record.
    db.db.collection(globals.col_users, function(err, collection) {
        collection.findOne(search, function(err, urecord) {

            var ret = {};
            var roles = [];
            if (err) {
                logger.log.error('getUserPerms: Error accessing user collection: ', err);
                ret = status.statusCode(1, 'role', 'Error accessing user collection.');
                deferred.reject(ret);
            }
            else {

                // If the user record cannot be found, the "user" is in the anonymous role by default.
                if (urecord === undefined || urecord === null || urecord === {}) {
                    roles.push(exports.ROLE_ANONYMOUS);
                }

                // Load all the role objects for the role(s) this user is assigned.
                if (urecord.hasOwnProperty('roles')) {
                    roles = urecord.roles;
                }

                db.db.collection(col_roles, function(err, collection) {
                    collection.find({name: {$in:roles}}).toArray(function(err, items) {
                        var perms = mergeRolePerms(items, permGroup);
                        deferred.resolve(perms);
                    });
                });  
            } // else
        });
    });

    return deferred.promise;
}



// Passing in an array of role objects, return an array of merged permission groups with permissions.
//
var mergeRolePerms = function (roleArray, permGroup) {

    //var mergedPerms = [];
    var mergedPerms = {};

    for (var i = 0; i < roleArray.length; i++) {

        var pgs = roleArray[i].permGroups;

        if (pgs.hasOwnProperty(permGroup)) {
            for (var perm in pgs[permGroup]) {
                if (pgs[permGroup][perm] === true) {
                    mergedPerms[perm] = true;
                    //mergedPerms[perm] = pgs[permGroup][perm];
                    //mergedPerms[perm] = mergedPerms[perm] ? mergedPerms[perm] : pgs[permGroup][perm];
                }
            }
        }
    }

    //return _.uniq(mergedPerms);
    return mergedPerms;
}


