/*

Comment.js - This module extends the node content type to manage "comment nodes"

*/

var globals = require('../global/globals');
var status = require('../global/status');
var logger = require('../global/logger');
var util = require('../global/utility');
var _ = require('lodash');
var Q = require('q');
var node = require('./node');
var nodeapi = require('./node_api');
var roleapi = require('../users/role_api');



// Initialize the permissions for basic nodes.
var comment_perms = ['create', 
                  'read_any', 
                  'read_own', 
                  'delete_any', 
                  'delete_own', 
                  'edit_any', 
                  'edit_own'];

// The name of this content type
exports.NODE_TYPE_COMMENT = "comment";



// Node extender for creating a comment node.
//
exports.createComment = function (node, reqData) {

	node.type = exports.NODE_TYPE_COMMENT;

	if (reqData.hasOwnProperty("parent") && reqData.parent) {
		node.parent = reqData.parent;

		// TODO Need to look up the parent node and add this node as a child.
		addChildNode(node.parent) // SHIT -- need the child's NID which I don't have yet.
	}
	else {
		logger.log.error("comment.createComment: Creating a comment without a parent.");
		node.parent = null;
	}

	if (reqData.hasOwnProperty("child") && reqData.child) {
		node.children.push(reqData.child);
	}

	logger.log.debug("comment.createComment: In extender node = \n", node, "\nreqData = \n", reqData);

	return node;
}


// Node extender for creating a comment node.
//
exports.updateComment = function (node, reqData) {

	// Safety to ensure the node type is correct.
	node.type = exports.NODE_TYPE_COMMENT;

	if (reqData.hasOwnProperty("company") && reqData.company) {
		node.company = reqData.company;
	}

	logger.log.debug("comment.updateComment: In extender node = \n", node, "\nreqData = \n", reqData);

	return node;
}


// -- Initialization ------------------------------------------------

// Register permissions with the role api.
roleapi.registerPermissions(exports.NODE_TYPE_COMMENT, comment_perms);

// Setup the node routes for job nodes
node.setNodeRoutes (exports.NODE_TYPE_COMMENT, function(app) {

	app.post('/comment',              util.curry(node.createNode, exports.createComment) );
	app.post('/comment/update/:id',   util.curry(node.updateNode, exports.updateComment) );

});
