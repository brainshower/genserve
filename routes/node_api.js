/*
Node - Handle all basic interactions with a node, and include linkage to other content types.

*/

var globals = require('../global/globals');
var status = require('../global/status');
var logger = require('../global/logger');
var dbopen = require('../global/dbopen');
var roleapi = require('../users/role_api');
var moment = require('moment');
var async = require('async');
var _ = require('lodash');
var Q = require('q');


// Initialize the permissions for basic nodes.
var node_perms = ['create', 
                  'read_any', 
                  'read_own', 
                  'delete_any', 
                  'delete_own', 
                  'edit_any', 
                  'edit_own'];



// Permission resolver.  With a list of permissions available, resolves them to the permissions available for a given node.
// Pass in permissions object, and boolean if the object is owned by the given user with these permissions.
//
var defaultPermissionResolver = function (perms, owner) {

    var resolvedPerms = {};
    var read_any = false;
    var edit_any = false;
    var delete_any = false;

    for (perm in perms) {
        if(perms.hasOwnProperty(perm)) {
            switch (perm) {
                case 'create':
                    resolvedPerms.create = true;
                    break;
                case 'read_any':
                    resolvedPerms.read = true;
                    read_any = true;
                case 'read_own':
                    resolvedPerms.read = (read_any || owner) ? true : false;
                    break;
                case 'delete_any':
                    resolvedPerms.delete = true;
                    delete_any = true;
                case 'delete_own':
                    resolvedPerms.delete = (delete_any || owner) ? true : false;
                    break;
                case 'edit_any':
                    resolvedPerms.edit = true;
                    edit_any = true;
                case 'edit_own':
                    resolvedPerms.edit = (edit_any || owner) ? true : false;
                    break;
            }
        }
    }
    return resolvedPerms;
};


// Basic node type.
exports.NODE_BASIC = "basic";



// Create a new node.  Pass in title, body, and optional extender function for adding more fields, and optional permission resolver function.
//
//exports.createNode = function (title, body, uid, nodeExtender, permResolver) {
exports.createNode = function (title, body, uid, nodeExtender, permResolver) {

    var db = dbopen.getDB();
    var deferred = Q.defer();

    var node = {
      title : (title) ? title : null,
      body : (body) ? body : null,
      creationDate : moment.utc(new Date(Date.now())).toString(),
      type : exports.NODE_BASIC,
    };

    // If a uid was passed in, find the associated username an put into the node object.
    if (uid) {
        node.uid = uid;
        db.db.collection(globals.col_users, function(err, collection) {
            collection.findOne({'_id': new db.BSON.ObjectID(uid)}, function(err, item) {
                var ret = {};
                if (err) {
                    ret = status.statusCode(1, 'nodeapi', 'Error finding user uid: ' + uid);
                    deferred.reject(ret);
                }
                else { 
                    if (item.hasOwnProperty('username')) {
                        node.username = item.username;
                    }
                    predicate();
                }
    
            });
        });
    }
    else {
        predicate();
    }

    function predicate () {

        // Call an extension function to further manipulate the node object before insertion.
        // Extender function should change the node type (if adding fields), and could change the owner UID.
        if (nodeExtender) {
            node = nodeExtender(node);
        }
    
        // Check if we have create permissions. This is done after the extender function call to ensure
        // we know the correct node type (which may have been changed by the extender function).
        roleapi.getUserPerms({uid : uid}, node.type).then(
            function (perms) {
                var ret = {};
                if (_.has(perms, 'create')) {

                    // Insert into the database.
                    db.db.collection(globals.col_nodes, function(err, collection) {
                        collection.insert(node, {safe:true}, function(err, result) {
                            if (err) {
                                ret = status.statusCode(2, 'nodeapi', 'Error has occurred on insertion')
                                deferred.reject(ret);
                            } 
                            else {
                                // Success!  Not send the permissions back with the object.
                                ret = status.success('nodeapi')
                                ret.node = result[0];
                                if (permResolver) {
                                    ret.node.perms = permResolver(perms, uid === node.uid);
                                }
                                else {
                                    ret.node.perms = defaultPermissionResolver(perms, true); // attach the permissions to the node object.
                                }
                                deferred.resolve(ret);
                            }
                        });
                    }); // insert
                } // create
                else {
                    // Do not have permissions to create the object.
                    ret = status.statusCode(3, 'perm', 'No permission to create.')
                    deferred.reject(ret);
                }
            },
            function (status) {
                // This is called when an error occurs, like the database error.
                deferred.reject(status);
            } 
        ); // roleapi
    };
    
    return deferred.promise;
}


// Update an existing node.  Pass in a node object (only fields to be updated should be set), and
// nodeExtender function for updating other fields.
//
exports.updateNode = function (nid, object, uid, nodeExtender, permResolver) {

    var node = {};
    var origOwner = false;
    var origType;
    var db = dbopen.getDB();
    var deferred = Q.defer();

    // Get the node so we can check its type.
    db.db.collection(globals.col_nodes, function(err, collection) {
        collection.findOne({'_id': new db.BSON.ObjectID(nid)}, function(err, item) {
            if (err) {
                ret = status.statusCode(1, 'nodeapi', 'Could not load the node.');
                deferred.reject(ret);
            }
            else {
                // Capture if the UID passed in owns this node, the node type, and continue.
                origOwner = (item.uid === uid);  // Capture if the owner is wanting to update his node.
                origType = item.type;  // Capture the node type.
                node = item;
                predicate();
            }
        });
    });

    // Check user permissions for this node update.
    function predicate () {

        // Update the node object with new data if passed in via the object parameter.
        if (object.hasOwnProperty('title')) {
            node.title = object.title;
        }
        if (object.hasOwnProperty('body')) {
            node.body = object.body;
        }
        
        // Check permissions based on the original type of the node (versus a possible type change by the extender fn)
        roleapi.getUserPerms({uid : uid}, origType).then(
            function (perms) {
                var ret = {};
                // If the permissions allow editing any node just update it.
                if (_.has(perms, 'edit_any')) {
                    logger.log.debug("nodeapi:  User has permission to edit any node.");
                    predicate2();
                }
                // Otherwise, if the user can edit his own node, keep going.
                else if (_.has(perms, 'edit_own') && origOwner) {
                    logger.log.debug("nodeapi:  User has permission to edit his own nodes.");
                    predicate2();
                }
                else {
                    logger.log.debug("nodeapi:  User does not have permission to edit this node.");
                    ret = status.statusCode(2, 'perm', 'User does not have permission to update.');
                    deferred.reject(ret);
                }
    
            }, // getUserPerms function
            function (error) {
                logger.log.debug("nodeapi:  First check of user perms for existing node failed.");
                ret = status.statusCode(3, 'nodeapi', 'Could not get user permissions for existing node.');
                deferred.reject(ret);
            }

        );
    }; // predicate

    // Perform the node update.  We're just re-inserting the node (not updating fields).  Since we're single-threaded,
    // this should be an effective atomic operation and safe.
    function predicate2 () {

        // Call extender function to set fields for updating.  This is done at the very end just before updating.
        // Extender function could possibly add fields, or change the node type or owner UID.
        if (nodeExtender) {
            node = nodeExtender(node);
        }

        db.db.collection(globals.col_nodes, function(err, collection) {
            collection.update({'_id' : new db.BSON.ObjectID(nid)}, node, {safe:true}, function(err, result) {
                if (err) {
                    logger.log.debug("nodeapi:  Could not update the node.");
                    ret = status.statusCode(4, 'nodeapi', 'Error has occurred on update');
                    deferred.reject(ret);
                }
                else {
                    predicate3();
                }
            });
        });
    }; // predicate2

    // Finally, get node and its permissions based on the possible new type & owner of the node (may changed by the extender fn)
    function predicate3 () {

        db.db.collection(globals.col_nodes, function (err, collection) {
            collection.findOne({'_id': new db.BSON.ObjectID(nid)}, function (err, item) {
                if (err) {
                    ret = status.statusCode(5, 'nodeapi', 'Error retrieving node after update.');
                    deferred.reject(ret);
                }  
                else {
                    roleapi.getUserPerms({uid : uid}, item.type).then(
                        function (perms) {
                            var ret = {};
                            logger.log.debug("nodeapi:  Successfully updated the node.");
                            ret = status.success('nodeapi');
                            ret.node = item;
                            if (permResolver) {
                                ret.node.perms = permResolver(perms, uid === item.uid);
                            }
                            else {
                                ret.node.perms = defaultPermissionResolver(perms, uid === item.uid);
                            }
                            deferred.resolve(ret);    
                        },
                        function (error) {
                            logger.log.debug("nodeapi:  Final check of user perms for updated node failed.");
                            ret = status.statusCode(6, 'nodeapi', 'Could not get user permissions for updated node.');
                            deferred.reject(ret);
                        }
                    );
                } // else
            })
        });

    }

    return deferred.promise;
}


// Find a node by its ID. 
// TODO This function really hasn't been used or tested.
// 
exports.findNodeById = function (nid, uid, permResolver) {

    var deferred = Q.defer();
    var db = dbopen.getDB();
    var owner = false;

    // Get the node and ensure the permissions allow the user to access it.
    db.db.collection(globals.col_nodes, function (err, collection) {
        collection.findOne({'_id': new db.BSON.ObjectID(nid)}, function (err, item) {
            if (err) {
                ret = status.statusCode(1, 'nodeapi', 'Error finding node.');
                deferred.reject(ret);
            }  
            else {
                roleapi.getUserPerms({uid : uid}, node.type).then(
                    function (perms) {
                        owner = (uid === item.uid); // Set the flag if this user is the owner of the node.
                        if (_.has(perms, 'read_any')) {
                            logger.log.debug("nodeapi:  User has permission to read any node.");
                            predicate(item, perms);
                        }
                        // Otherwise, if the user can edit his own node, keep going.
                        else if (_.has(perms, 'read_own') && owner) {
                            logger.log.debug("nodeapi:  User has permission to read his own nodes.");
                            predicate(item, perms);
                        }
                        else {
                            logger.log.debug("nodeapi:  User does not have permission to read this node.");
                            var ret = status.statusCode(2, 'perm', 'User does not have permission to read.');
                            deferred.reject(ret);
                        }
                    },
                    function (fail) {
                        logger.log.debug("nodeapi:  Could not get user perms for node.");
                        ret = status.statusCode(3, 'nodeapi', 'Could not get user permissions for node.');
                        deferred.reject(ret);
                    }
                );
            }
 
        });
    });

    // Return the found node with the resolved permissions available to the client.
    function predicate (item, perms) {
        var ret = status.success('nodeapi')
        ret.node = item;
        // Return appropriate permissions that user can execute on this object.
        if (perms) {
            if (permResolver) {
                ret.node.perms = permResolver(perms, owner);
            }
            else {
                ret.node.perms = defaultPermissionResolver(perms, owner);
            }
        }
        deferred.resolve(ret);
    };

    return deferred.promise;
};


// Find all nodes by a content type.  If type not passed in, all node types are found.
// The optional permission resolver function is used to override the default permissions for all nodes.
// 
exports.findNodesByType = function(type, uid, permResolver) {

    var deferred = Q.defer();
    var db = dbopen.getDB();

    var search = {};
    if (type) {
        search.type = type;
    }
    
    db.db.collection(globals.col_nodes, function(err, collection) {
        collection.find(search).toArray(function(err, items) {
            var ret = {};
            if (err) {
                ret = status.statusCode(1, 'nodeapi', 'Error retrieving nodes.');
                deferred.reject(ret); 
            }
            else {
                // Attach permission information to each node object.
                ret = status.success('nodeapi');
                ret.nodes = [];
                var i = 0;
                async.whilst(
                    // Test condition
                    function () { return (i < items.length) }, 
                    // Called each iteration
                    function (callback) {
                        i++;
                        roleapi.getUserPerms({uid : uid}, items[i-1].type || exports.NODE_BASIC).then(
                            function(perms) {
                                var owner = (uid === items[i-1].uid); // Set flag that the user is the owner of this node.
                                if (_.has(perms, 'read_any') || (_.has(perms, 'read_own') && owner)) {
                                    logger.log.debug("nodeapi:  User has permission to read the node.");
                                    if (permResolver) {
                                        items[i-1].perms = permResolver(perms, owner);    
                                    }
                                    else {
                                        items[i-1].perms = defaultPermissionResolver(perms, owner);
                                    }

                                    // Add this node to the list of approved nodes to return.
                                    ret.nodes.push(items[i-1]);
                                }

                                callback(); 
                            },
                            function (fail) {
                                // No permissions found.  Just send back (probably should return anonymous role perms at some point.)
                                callback(); 
                            }
                        );
                    },
                    // Final function called when above functions are done.
                    function () {
                        deferred.resolve(ret);
                    }
                );
            } // else
        });
    });

    return deferred.promise;
};


// Delete a node by passing in the node ID.
// 
exports.deleteNode = function(nid, uid, nodeExtender) {

    var deferred = Q.defer();
    var db = dbopen.getDB();
    var origType;
    var origOwner = false;

    // Get the node so we can check its type.
    db.db.collection(globals.col_nodes, function(err, collection) {
        collection.findOne({'_id': new db.BSON.ObjectID(nid)}, function(err, item) {
            if (err) {
                ret = status.statusCode(1, 'nodeapi', 'Could not retrieve the node.');
                deferred.reject(ret);
            }
            else {
                // Capture if the UID passed in owns this node, the node type, and continue.
                origOwner = (item.uid === uid);
                origType = item.type;  // Capture the node type.
                predicate();
            }
        });
    });

    // Check permissions for this node deletion.
    function predicate () {
        roleapi.getUserPerms({uid : uid}, origType).then(
            function (perms) {
                var ret = {};
                // If the permissions allow editing any node just update it.
                if (_.has(perms, 'delete_any')) {
                    logger.log.debug("nodeapi:  User has permission to delete any node.");
                    predicate2();
                }
                // Otherwise, if the user can edit his own node, keep going.
                else if (_.has(perms, 'delete_own') && origOwner) {
                    logger.log.debug("nodeapi:  User has permission to delete his own nodes.");
                    predicate2();
                }
                else {
                    logger.log.debug("nodeapi:  User does not have permission to delete this node.");
                    ret = status.statusCode(2, 'perm', 'User does not have permission delete.');
                    deferred.reject(ret);
                }

            } // getUserPerms function
        );
    } // predicate

    // Delete the node
    function predicate2 () {
        db.db.collection(globals.col_nodes, function(err, collection) {
            collection.remove({'_id':new db.BSON.ObjectID(nid)}, {safe:true}, function(err, result) {
                var ret = {};
                if (err) {
                    ret = status.statusCode(3, 'nodeapi', 'Error deleting node');
                    deferred.reject(ret); 
                }
                else {
                    // Now that the node has been deleted successfully, call the extender function so anything else related can be deleted.
                    if (nodeExtender) {
                        node = nodeExtender(node);
                    }
                    ret = status.success('nodeapi')
                    deferred.resolve(ret); 
                }
            });
        });
    }
    return deferred.promise;
}


// -- Initialization ------------------------------------------------

// Register permissions with the role api.
roleapi.registerPermissions(exports.NODE_BASIC, node_perms);
