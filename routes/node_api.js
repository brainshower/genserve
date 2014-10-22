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
var node_type = "basic";
var node_perms = ['read_all', 'read_own', 'create', 'delete_own', 'delete_any', 'edit_own', 'edit_any'];

roleapi.registerPermissions(node_type, node_perms);


// Create a new node.  Pass in title, body, and optionally an extender function for adding more fields.
//
exports.createNode = function (title, body, uid, extender) {

    var db = dbopen.getDB();
    var deferred = Q.defer();

    var node = {
      title : title,
      body : (body !== null && body !== undefined) ? body : null,
      creationDate : moment.utc(new Date(Date.now())).toString(),
      type : node_type,
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
        context.predicate();
    }

    var predicate = function() {

        // Call an extension function to further manipulate the node object before insertion.
        // Extender must at least set the type of node object.
        if (extender !== null && extender !== undefined) {
            node = extender(node);
        }
    
        // Check if we have create permissions. This is done after the extender function call to ensure
        // we know the correct node type (which may have been changed by the extender function).
        roleapi.getUserPerms({uid : uid}, node.type).then(
            function (perms) {
                var ret = {};
                if (_.contains(perms, 'create')) {

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
                                ret.node.perms = perms; // attach the  permissions to the node object.
                                deferred.resolve(ret);
                            }
                        });
                    }); // insert
                } // create
                else {
                    // Do not have permissions to create the object.
                    ret = status.statusCode(3, 'nodeapi', 'No permission to create.')
                    deferred.reject(ret);
                }
            } // function
        ); // roleapi
    };

    return deferred.promise;
}


// Update an existing node.  Pass in a node object (only fields to be updated need be set), and
// extender function for updating other fields.
//
exports.updateNode = function (nid, object, extender, uid) {

    var node = {};
    var db = dbopen.getDB();
    var deferred = Q.defer();

    if (object.hasOwnProperty('title')) {
        node.title = object.title;
    }
    if (object.hasOwnProperty('body')) {
        node.body = object.body;
    }

    // Extender to set fields for updating.
    if (extender !== null && extender !== undefined) {
        node = extender(node);
    }
 
    db.db.collection(globals.col_nodes, function(err, collection) {
        collection.update({'_id' : new db.BSON.ObjectID(nid)}, {$set: node}, {safe:true}, function(err, result) {
            var ret = {};
            if (err) {
                ret = status.statusCode(1, 'nodeapi', 'Error has occurred on update');
                deferred.reject(ret);
            }  
            else {
                ret = status.success('nodeapi')
                //ret.node = result[0];
                deferred.resolve(ret);
            }
        });
    });

    return deferred.promise;
}


// Find a node by its ID.
// 
exports.findNodeById = function(nid, uid) {

    var deferred = Q.defer();
    var db = dbopen.getDB();

    db.db.collection(globals.col_nodes, function(err, collection) {
        collection.findOne({'_id': new db.BSON.ObjectID(nid)}, function(err, item) {
            var ret = {};
            if (err) {
                ret = status.statusCode(1, 'nodeapi', 'Error finding node');
                deferred.reject(ret);
            }  
            else {
                roleapi.getUserPerms({uid : uid}, node.type).then(
                    function(success) {
                        ret = status.success('nodeapi')
                        ret.node = item;
                        ret.node.perms = success; // attach the returned permissions to the node object.
                        deferred.resolve(ret);
                    },
                    function (fail) {
                        // No permissions found.  Just send back (probably should return anonymous role perms at some point.)
                        ret = status.success('nodeapi')
                        ret.node = item;
                        deferred.resolve(ret);
                    }
                );
            }
 
        });
    });

    return deferred.promise;
};


// Find all nodes by a content type.  If type not passed in, all node types are found.
// 
exports.findNodesByType = function(type, uid) {

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
                ret = status.statusCode(1, 'nodeapi', 'Error finding nodes.');
                deferred.reject(ret); 
            }
            else {
                // Attach permission information to each node object.
                ret = status.success('nodeapi')
                ret.nodes = items;
                var i = 0;
                async.whilst(
                    // Test condition
                    function() { return (i < ret.nodes.length) }, 
                    // Called each iteration
                    function(callback) {
                        i++;
                        roleapi.getUserPerms({uid : uid}, ret.nodes[i-1].type || node_type).then(
                            function(success) {
                                ret.nodes[i-1].perms = [];
                                ret.nodes[i-1].perms = success;
                                callback(); 
                            },
                            function (fail) {
                                // No permissions found.  Just send back (probably should return anonymous role perms at some point.)
                                callback(); 
                            }
                        );
                    },
                    // Final function called when above functions are done.
                    function() {
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
exports.deleteNode = function(nid, extender, uid) {

    var deferred = Q.defer();
    var db = dbopen.getDB();

    db.db.collection(globals.col_nodes, function(err, collection) {
        collection.remove({'_id':new db.BSON.ObjectID(nid)}, {safe:true}, function(err, result) {
            var ret = {};
            if (err) {
                ret = status.statusCode(1, 'nodeapi', 'Error deleting node');
                deferred.reject(ret); 
            }
            else {
                // Now that the node has been deleted successfully, call the extender function so anything else related can be deleted.
                if (extender !== null && extender !== undefined) {
                   node = extender(node);
               }

               ret = status.success('nodeapi')
               deferred.resolve(ret); 
            }
        });
    });

    return deferred.promise;
}
