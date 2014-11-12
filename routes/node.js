/**

Node.js - This module's functions handle the inbound HTTP requests from the REST API, and 
in turn call the NODE API to execute the actual commands.

*/

var globals = require('../global/globals');
var logger = require('../global/logger');
var status = require('../global/status');
var nodeapi = require('./node_api');
var auth = require ('../users/auth');


// Create a node using the request and response data from the HTTP request.
// Node extender function is used by modules that extend nodes to create other content types.
//
exports.createNode = function (fnNodeExtender, req, res) {

    var session = (req.body && req.body.hasOwnProperty("session")) ? req.body.session : null; // session object.
    var reqData = (req.body && req.body.hasOwnProperty("data")) ? req.body.data : null;
    var node = {}; // new node object

    node.title = reqData.hasOwnProperty("title") ? reqData.title : null;
    node.body = reqData.hasOwnProperty("body") ? reqData.body : null;

    logger.log.info("node.createNode: Creating node: ", node);

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {

        auth.auth(session.uid, session.token).then(
            function (authResult) {

                nodeapi.createNode (node, reqData, session.uid, fnNodeExtender).then(
                    function(result) {
                        logger.log.debug("node.createNode: Node created: ", result);
                        res.send(result.node);
                    },
                    // Error creating node
                    function(error) {
                        logger.log.error("node.createNode: Error creating node. Result = ", error);
                        res.send(500, error);
                    }
                );

            },
            // Authentication error
            function (error) {
                logger.log.error("node.createNode: Could not authenticate. Error = ", error);
                res.send(500, error);
            }
        );
    } // if session
    else {
        // No session variable passed in.  Assume it's anonymous.
        nodeapi.createNode (node, reqData, null, fnNodeExtender).then(
            function(result) {
                logger.log.debug("node.createNode: Node created: ", result);
                res.send(result.node);
            },
            // Error creating node
            function(error) {
                logger.log.error("node.createNode: Error creating node. Result = ", error);
                res.send(500, error);
            }
        );

    }
}


// Update a node using the request and response data from the HTTP request.
// Node extender function is used by modules that extend nodes to create other content types.
//
exports.updateNode = function (fnNodeExtender, req, res) {

    var session = (req.body && req.body.hasOwnProperty("session")) ? req.body.session : null; // session object.
    var reqData = (req.body && req.body.hasOwnProperty("data")) ? req.body.data : null;
    var nid = req.params.id;
    var node = {};

    node.title = (reqData.hasOwnProperty("title")) ? reqData.title : undefined;
    node.body = (reqData.hasOwnProperty("body")) ? reqData.body : undefined;

    logger.log.info("node.updateNode: Updating node (id, node): ", nid, node);

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                nodeapi.updateNode (nid, node, reqData, session.uid, fnNodeExtender).then(
                    function(result) {
                        logger.log.debug("node.updateNode: Node updated. Result = ", result);
                        res.send(result);
                    },
                    function(error) {
                        logger.log.error("node.updateNode: Error updating node. Error = ", error);
                        res.send(500, error);
                    }
                );

            },
            // Authentication error
            function (error) {
                logger.log.error("node.updateNode: Could not authenticate. Error = ", error);
                res.send(500, error);
            }
        );
    } // if session
    else {
        // No session variable passed in.  Assume it's anonymous.
        nodeapi.updateNode (nid, node, reqData, null, fnNodeExtender).then(
            function(result) {
                logger.log.debug("node.updateNode: Node updated. Result = ", result);
                res.send(result);
            },
            function(error) {
                logger.log.error("node.updateNode: Error updating node. Error = ", error);
                res.send(500, error);
            }
        );
    }
}


// Find node by the node ID using the request and response data from the HTTP request.
// Node: the node extender does nothing in this function; it's there for consistency with the other functions.
//
exports.findNodeById = function (fnNodeExtender, req, res) {

    var nid = req.params.id;
    var session = (req.body && req.body.hasOwnProperty("session")) ? req.body.session : null; // session object.

    logger.log.info("node.findNodeById: Finding node (id): ", nid);

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                nodeapi.findNodeById (nid, session.uid).then(
                    function(result) {
                        logger.log.debug("node.findNodeById: Node found. Result = ", result);
                        res.send(result.node);
                    },
                    function(error) {
                        logger.log.error("node.findNodeById: Node not found. Error = ", error);
                        res.send(500, error);
                    }
                );
            },
            // Authentication error
            function (error) {
                logger.log.error("node.findNodeById: Could not authenticate. Error = ", error);
                res.send(500, error);
            }
        );
    } // if session
    else {
        // No session variable passed in.  Assume it's anonymous.
        nodeapi.findNodeById (nid, null).then(
            function(result) {
                logger.log.debug("node.findNodeById: Node found. Result = ", result);
                res.send(result.node);
            },
            function(error) {
                logger.log.error("node.findNodeById: Node not found. Error = ", error);
                res.send(500, error);
            }
        );
    }
}


// Find node by the node type using the request and response data from the HTTP request.
// Node: the node extender does nothing in this function; it's there for consistency with the other functions.
//
exports.findAllNodes = function (fnNodeExtender, req, res) {

    var session = (req.body && req.body.hasOwnProperty("session")) ? req.body.session : null; // session object.
    var searchType = (req.body && req.body.hasOwnProperty("type")) ? req.body.type : null; // type object.

    logger.log.info("node.findAllNodes: Finding by type (type): ", searchType);

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                nodeapi.findNodesByType (searchType, session.uid).then(
                    function (result) {
                        logger.log.debug("node.findAllNodes: Node(s) found. Result = ", result);
                        res.send(result.nodes);
                    },
                    function (error) {
                        logger.log.error("node.findAllNodes: Node(s) not found. Error = ", error);
                        res.send(500, error);
                    }
                );
            },
            // Authentication error
            function (error) {
                logger.log.error("node.findAllNodes: Could not authenticate. Error = ", error);
                res.send(500, error);
            }
        );
    } // if session
    else {
        // If no session, then this is an anonymous request.  Let Node API 
        // determine if it has permission to execute.
        nodeapi.findNodesByType (searchType, null).then(
            function (result) {
                logger.log.debug("node.findAllNodes: Node(s) found. Result = ", result);
                res.send(result.nodes);
            },
            function (error) {
                logger.log.error("node.findAllNodes: Node(s) not found. Error = ", error);
                res.send(500, error);
            }
        );
    }
}


// Delete node by node ID.
// Node: the node extender does nothing in this function; it's there for consistency with the other functions.
//
exports.deleteNode = function (fnNodeExtender, req, res) {

    var nid = req.params.id;
    var session = (req.body && req.body.hasOwnProperty("session")) ? req.body.session : null; // session object.

    logger.log.info("node.deleteNode: Deleting node (nid): ", nid);

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                nodeapi.deleteNode (nid, session.uid, fnNodeExtender).then(
                    function (result) {
                        logger.log.debug("node.deleteNode: Node deleted. Result = ", result);
                        res.send({});
                    },
                    function (error) {
                        logger.log.error("node.deleteNode: Node not deleted. Error = ", error);
                        res.send(500, error);
                    }
                );

            },
            // Authentication error
            function (error) {
                logger.log.error("node.deleteNode: Could not authenticate. Error = ", error);
                res.send(500, error);
            }
        );
    } // if session
    else {
        // No session variable passed in.  Assume it's anonymous.
        nodeapi.deleteNode (nid, null, fnNodeExtender).then(
            function (result) {
                logger.log.debug("node.deleteNode: Node deleted. Result = ", result);
                res.send({});
            },
            function (error) {
                logger.log.error("node.deleteNode: Node not deleted. Error = ", error);
                res.send(500, error);
            }
        );
    }
}
