var globals = require('../global/globals');
var logger = require('../global/logger');
var status = require('../global/status');
var nodeapi = require('./node_api');
var auth = require ('../users/auth');


// Create a node using the request and response data from the HTTP request.
//
exports.createNode = function (apiCall, req, res) {

    var api_createNode = apiCall ? apiCall : nodeapi.createNode;
    var session = req.body.hasOwnProperty("session") ? req.body.session : null; // session object.
    var node = {};
    var reqData = (req.body && req.body.hasOwnProperty("data")) ? req.body.data : null;

    node.title = (reqData.hasOwnProperty("title")) ? reqData.title : null;
    node.body = (reqData.hasOwnProperty("body")) ? reqData.body : null;

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        logger.log.info("createNode: Creating node: ", node);
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                api_createNode(node, reqData, session.uid).then(
                    function(result) {
                        logger.log.info("createNode: Node created: ", result);
                        res.send(result.node);
                    },
                    // Error creating node
                    function(error) {
                        res.send(500, error);
                    }
                );

            },
            // Authentication error
            function (error) {
                res.send(500, error);
            }
        );
    } // if session
    else {
        // No session variable passed in.  Assume it's anonymous.
        api_createNode(node, reqData, null).then(
            function(result) {
                logger.log.info("createNode: Node created: ", result);
                res.send(result.node);
            },
            // Error creating node
            function(error) {
                res.send(500, error);
            }
        );

    }
}


// Update a node using the request and response data from the HTTP request.
//
exports.updateNode = function (apiCall, req, res) {

    var api_updateNode = apiCall ? apiCall : nodeapi.updateNode;
    var session = req.body.hasOwnProperty("session") ? req.body.session : null; // session object.
    var nid = req.params.id;
    var node = {};
    var reqData = (req.body && req.body.hasOwnProperty("data")) ? req.body.data : null;

    node.title = (reqData.hasOwnProperty("title")) ? reqData.title : undefined;
    node.body = (reqData.hasOwnProperty("body")) ? reqData.body : undefined;

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                logger.log.info("updateNode: Updating node (id, node): ", nid, node)
                api_updateNode(nid, node, reqData, session.uid).then(
                    function(result) {
                        logger.log.debug("updateNode: Success updating node. Result = ", JSON.stringify(result));
                        res.send(result);
                    },
                    function(error) {
                        logger.log.debug("updateNode: Error updating node. Result = ", JSON.stringify(error));
                        res.send(500, error);
                    }
                );

            },
            // Authentication error
            function (error) {
                res.send(500, error);
            }
        );
    } // if session
    else {
        // No session variable passed in.  Assume it's anonymous.
        logger.log.info("updateNode: Updating node (id, node): ", nid, title, body)
        api_updateNode(nid, node, reqData, null).then(
            function(result) {
                logger.log.debug("updateNode: Success updating node. Result = ", JSON.stringify(result));
                res.send(result);
            },
            function(error) {
                logger.log.debug("updateNode: Error updating node. Result = ", JSON.stringify(error));
                res.send(500, error);
            }
        );
    }
}


// Find node by the node ID using the request and response data from the HTTP request.
//
exports.findNodeById = function (apiCall, req, res) {

    var nid = req.params.id;
    var session = req.body.hasOwnProperty("session") ? req.body.session : null; // session object.

    var api_findNodeById = apiCall ? apiCall : nodeapi.findNodeById;

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                logger.log.info("findNodeById: (id): ", nid);
                api_findNodeById(nid, session.uid).then(
                    function(result) {
                        res.send(result.node);
                    },
                    function(error) {
                        res.send(500, error);
                    }
                );
            },
            // Authentication error
            function (error) {
                res.send(500, error);
            }
        );
    } // if session
    else {
        // No session variable passed in.
        var s = status.statusCode(999, "node", "No session object passed in.");
        res.send(500, s);
    }
}


// Find node by the basic node type using the request and response data from the HTTP request.
//
exports.findAllNodes = function (apiCall, req, res) {

    var session = req.body.hasOwnProperty("session") ? req.body.session : null; // session object.

    var api_findNodesByType = apiCall ? apiCall : nodeapi.findNodesByType;

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                logger.log.info("findAllNodes:");
                api_findNodesByType("basic", session.uid).then(
                    function (result) {
                        logger.log.debug("findAllNodes: ", result);
                        res.send(result.nodes);
                    },
                    function (error) {
                        res.send(500, error);
                    }
                );
            },
            // Authentication error
            function (error) {
                res.send(500, error);
            }
        );
    } // if session
    else {
        // No session variable passed in.
        // var s = status.statusCode(999, "node", "No session object passed in.");
        // res.send(500, s);
        //
        // If no session, then this is an anonymous request.  Let Node API 
        // determine if it has permission to execute.
        logger.log.info("findAllNodes:");
        api_findNodesByType("basic", null).then(
            function (result) {
                logger.log.debug("findAllNodes: ", result);
                res.send(result.nodes);
            },
            function (error) {
                res.send(500, error);
            }
        );
    }
}


// Find node by the basic node type using the request and response data from the HTTP request.
//
exports.deleteNode = function (apiCall, req, res) {

    var nid = req.params.id;
    var session = req.body.hasOwnProperty("session") ? req.body.session : null; // session object.

    var api_deleteNode = apiCall ? apiCall : nodeapi.deleteNode;

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                logger.log.info("deleteNode: nid ", nid);
                api_deleteNode(nid, session.uid).then(
                    function (result) {
                        res.send({});
                    },
                    function (error) {
                        res.send(500, error);
                    }
                );

            },
            // Authentication error
            function (error) {
                res.send(500, error);
            }
        );
    } // if session
    else {
        // No session variable passed in.  Assume it's anonymous.
        logger.log.info("deleteNode: nid ", nid);
        api_deleteNode(nid, null, null).then(
            function (result) {
                res.send({});
            },
            function (error) {
                res.send(500, error);
            }
        );
    }
}
