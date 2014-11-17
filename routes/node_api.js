/*

node_api.js - Execute all commands for node, which includes calling extenders to allow for other content types.

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

var node_perm_create = 'create';
var node_perm_readany = 'read_any';
var node_perm_readown = 'read_own';
var node_perm_deleteany = 'delete_any';
var node_perm_deleteown = 'delete_own';
var node_perm_editany = 'edit_any';
var node_perm_editown = 'edit_own';

// Initialize the permissions for basic nodes.
var node_perms = [node_perm_create, 
                  node_perm_readany,
                  node_perm_readown,
                  node_perm_deleteany,
                  node_perm_deleteown,
                  node_perm_editany,
                  node_perm_editown,
                  ];


// Basic node type.
exports.NODE_BASIC = "basic";


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


// Create a new node.  Pass in title, body, and optional extender function for adding more fields, and optional permission resolver function.
//
exports.createNode = function (node, reqData, uid, nodeExtender, permResolver) {

    var db = dbopen.getDB();
    var deferred = Q.defer();

    if (!node) {
        // This shouldn't happen - Should always have a node object passed in.
        // Safety is to just create an empty object.
        node = {};
        logger.log.error("nodeapi.createNode: Called with no node object.");
    }

    // Set the basic data for the node.
    node.creationDate = moment.utc(new Date(Date.now())).toString();
    node.type = exports.NODE_BASIC;
    node.children = [];  // Array of children nodes, if any.
    node.parent = null;  // Parent node, if any.

    // If a uid passed in, find the associated username and add to the node as the creator/owner.
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
            var ret = nodeExtender(node, reqData);
            if (ret.hasOwnProperty('then')) {
                // Return value is a promise, so call that function.
                ret.then(function(obj) {
                    node = obj;
                    predicate2();
                });
            }
            else {
                // Extender didn't need a promise, so just use the value returned.
                node = ret;
                predicate2();
            }
        }
        else {
            predicate2();
        }
    }

    function predicate2() {

        // Check if we have create permissions. This is done after the extender function call to ensure
        // we know the correct node type (which may have been changed by the extender function).
        roleapi.getUserPerms({uid : uid}, node.type).then(
            function (perms) {
                var ret = {};
                if (_.has(perms, node_perm_create)) {

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
exports.updateNode = function (nid, object, reqData, uid, nodeExtender, permResolver) {

    var db = dbopen.getDB();
    var deferred = Q.defer();

    var node = {};
    var origOwner = false;
    var origType;

    // Get the node so we can check its type.
    db.db.collection(globals.col_nodes, function(err, collection) {
        collection.findOne({'_id': new db.BSON.ObjectID(nid)}, function(err, item) {
            if (err) {
                ret = status.statusCode(1, 'nodeapi', 'Could not load the node.');
                deferred.reject(ret);
            }
            else {
                // Capture if the UID passed in owns this node, the node type, and continue.
                origOwner = (item.uid === uid);  // Capture if the owner wants to update his own node.
                origType = item.type;  // Capture the node type.
                node = item;
                predicate();
            }
        });
    });

    // Check user permissions for this node update.
    function predicate () {

        // Update the node object with new data if passed in via the object parameter.
        if (object.hasOwnProperty('title') && object.title) {
            node.title = object.title;
        }
        if (object.hasOwnProperty('body') && object.body) {
            node.body = object.body;
        }
        if (object.hasOwnProperty('parent') && object.parent) {
            node.parent = object.parent;
        }
        if (object.hasOwnProperty('children') && object.children) {
            node.children = object.children;
        }
        
        // Check permissions based on the original type of the node (versus a possible type change by the extender fn)
        roleapi.getUserPerms({uid : uid}, origType).then(
            function (perms) {
                var ret = {};
                // If the permissions allow editing any node just update it.
                if (_.has(perms, node_perm_editany)) {
                    predicate2();
                }
                // Otherwise, if the user can edit his own node, keep going.
                else if (_.has(perms, node_perm_editown) && origOwner) {
                    predicate2();
                }
                else {
                    ret = status.statusCode(2, 'perm', 'User does not have permission to update.');
                    deferred.reject(ret);
                }
    
            }, // getUserPerms function
            function (error) {
                logger.log.error("nodeapi.updateNode: Initial check of user perms for existing node failed.");
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
            var ret = nodeExtender(node, reqData);
            if (ret.hasOwnProperty('then')) {
                // Return value is a promise, so call that function.
                ret.then(function(obj) {
                    node = obj;
                    predicate3();
                });
            }
            else {
                // Extender didn't need a promise, so just use the value returned.
                node = ret;
                predicate3();
            }
        }
        else {
            predicate3();
        }
    } // predicate2

    function predicate3 () {

        db.db.collection(globals.col_nodes, function(err, collection) {
            collection.update({'_id' : new db.BSON.ObjectID(nid)}, node, {safe:true}, function(err, result) {
                if (err) {
                    ret = status.statusCode(4, 'nodeapi', 'Error has occurred on update');
                    deferred.reject(ret);
                }
                else {
                    predicate4();
                }
            });
        });
    }; // predicate3

    // Finally, get node and its permissions based on the possible new type & owner of the node (may changed by the extender fn)
    function predicate4 () {

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
                            logger.log.error("nodeapi.updateNode: Final check of user perms for existing node failed.");
                            ret = status.statusCode(6, 'nodeapi', 'Could not get user permissions for updated node.');
                            deferred.reject(ret);
                        }
                    );
                } // else
            })
        });

    } // predicate4

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
                        if (_.has(perms, node_perm_readany)) {
                            predicate(item, perms);
                        }
                        // Otherwise, if the user can edit his own node, keep going.
                        else if (_.has(perms, node_perm_readown) && owner) {
                            predicate(item, perms);
                        }
                        else {
                            var ret = status.statusCode(2, 'perm', 'User does not have permission to read.');
                            deferred.reject(ret);
                        }
                    },
                    function (fail) {
                        logger.log.error("nodeapi.findNodeById: Could not get user perms for node.");
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
                                if (_.has(perms, node_perm_readany) || (_.has(perms, node_perm_readown) && owner)) {
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
                                logger.log.error("nodeapi.findNodesByType: Could not find any user perms for the node: ", fail);
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
exports.deleteNode = function(nid, uid, reqData, nodeExtender) {

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
                if (_.has(perms, node_perm_deleteany)) {
                    predicate2();
                }
                // Otherwise, if the user can edit his own node, keep going.
                else if (_.has(perms, node_perm_deleteown) && origOwner) {
                    predicate2();
                }
                else {
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
                if (err) {
                    var ret = status.statusCode(3, 'nodeapi', 'Error deleting node');
                    deferred.reject(ret); 
                }
                else {
                    // Now that the node has been deleted successfully, call the extender function so anything else related can be deleted.
                    predicate3();                    
                }
            });
        });
    }

    // Perform the node update.  We're just re-inserting the node (not updating fields).  Since we're single-threaded,
    // this should be an effective atomic operation and safe.
    function predicate3 () {

        // Call extender function to set fields for updating.  This is done at the very end just before updating.
        // Extender function could possibly add fields, or change the node type or owner UID.
        if (nodeExtender) {
            var ret = nodeExtender(node, reqData);
            if (ret.hasOwnProperty('then')) {
                // Return value is a promise, so call that function.
                ret.then(function(obj) {
                    predicate4();
                });
            }
            else {
                // Extender didn't need a promise, so just use the value returned.
                predicate4();
            }
        }
        else {
            predicate4();
        }
    } // predicate3

    function predicate4() {
        var ret = status.success('nodeapi');
        deferred.resolve(ret); 
    } // predicate4


    return deferred.promise;
}


// Add a child pointer childNID to a node parentNID.
//
exports.addChildNode = function (parentNID, childNID) {

    var deferred = Q.defer();
    var db = dbopen.getDB();
    var node = {};
    var ret;

    // Get the node.
    db.db.collection(globals.col_nodes, function(err, collection) {
        collection.findOne({'_id': new db.BSON.ObjectID(parentNID)}, function(err, item) {
            if (err) {
                ret = status.statusCode(1, 'nodeapi', 'Could not load the node.');
                deferred.reject(ret);
            }
            else {
                // Capture if the UID passed in owns this node, the node type, and continue.
                node = item;
                predicate();
            }
        });
    });

    // Create the child link and update the node again.
    function predicate () {

        if (node.hasOwnProperty('children') && Array.isArray(node.children)) {
            node.children.push(childNID);
        }
        else {
            node.children = [];
            node.children.push(childNID);

            db.db.collection(globals.col_nodes, function(err, collection) {
                collection.update({'_id' : new db.BSON.ObjectID(nid)}, node, {safe:true}, function(err, result) {
                    if (err) {
                        ret = status.statusCode(4, 'nodeapi', 'Error has occurred on update');
                        deferred.reject(ret);
                    }
                    else {
                        var ret = status.success('nodeapi');
                        deferred.resolve(ret); 
                    }
                });
            });
        } // else
    }

    return deferred.promise;
}

// -- Initialization ------------------------------------------------
roleapi.registerPermissions(exports.NODE_BASIC, node_perms);