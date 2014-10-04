var globals = require('../global/globals');
var logger = require('../global/logger');
var status = require('../global/status');
var nodeapi = require('./node_api');
var auth = require ('../users/auth');


// Create a node using the request and response data from the HTTP request.
//
exports.createNode = function (req, res) {

    var session = req.body.hasOwnProperty("session") ? req.body.session : null; // session object.
    var node = (req.body.data !== undefined && req.body.data !== null) ? req.body.data : null;
    var title = node.hasOwnProperty("title") ? node.title : null;
    var body = node.hasOwnProperty("body") ? node.body : null;

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                logger.log.info("createNode: Creating node (title, body): ", title, body);
                nodeapi.createNode(title, body, session.uid).then(
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
        // No session variable passed in.
        var s = status.statusCode(999, "node", "No session object passed in.");
        res.send(500, s);
    }
}


// Update a node using the request and response data from the HTTP request.
//
exports.updateNode = function (req, res) {

    var nid = req.params.id;
    var session = req.body.hasOwnProperty("session") ? req.body.session : null; // session object.
    var title = (req.body.data.title !== undefined && req.body.data.title !== null) ? req.body.data.title : null;

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                // If incoming title + body for update.
                if (req.body.data.hasOwnProperty("body")) {
                    var body = (req.body.data.body !== undefined && req.body.data.body !== null) ? req.body.data.body : null;
                    var node = {title: title,
                                body: body};
                    logger.log.info("updateNode: Updating node (id, title, body): ", nid, title, body)
                    nodeapi.updateNode(nid, node).then(
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
                // Else just a title to update.
                else {
                    var node = {title: title};
                    logger.log.info("updateNode: Updating node (id, title): ", nid, title);
                    nodeapi.updateNode(nid, node).then(
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


// Find node by the node ID using the request and response data from the HTTP request.
//
exports.findNodeById = function (req, res) {

    var nid = req.params.id;
    var session = req.body.hasOwnProperty("session") ? req.body.session : null; // session object.

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                logger.log.info("findNodeById: (id): ", nid);
                nodeapi.findNodeById(nid).then(
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
exports.findAllNodes = function (req, res) {

    var session = req.body.hasOwnProperty("session") ? req.body.session : null; // session object.

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                logger.log.info("findAllNodes:");
                nodeapi.findNodesByType("basic").then(
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
        var s = status.statusCode(999, "node", "No session object passed in.");
        res.send(500, s);
    }
}


// Find node by the basic node type using the request and response data from the HTTP request.
//
exports.deleteNode = function (req, res) {

    var nid = req.params.id;
    var session = req.body.hasOwnProperty("session") ? req.body.session : null; // session object.

    if (session && session.hasOwnProperty("uid") && session.hasOwnProperty("token")) {
        auth.auth(session.uid, session.token).then(
            function (authResult) {

                logger.log.info("deleteNode: nid ", nid);
                nodeapi.deleteNode(nid).then(
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
        // No session variable passed in.
        var s = status.statusCode(999, "node", "No session object passed in.");
        res.send(500, s);
    }
}
