/*

Job.js - This module extends the node content type to manage "job nodes"

*/

var globals = require('../global/globals');
var status = require('../global/status');
var logger = require('../global/logger');
var _ = require('lodash');
var Q = require('q');
var node = require('./node');
var nodeapi = require('./node_api');
var roleapi = require('../users/role_api');


// Initialize the permissions for basic nodes.
var job_perms = ['create', 
                  'read_any', 
                  'read_own', 
                  'delete_any', 
                  'delete_own', 
                  'edit_any', 
                  'edit_own'];

// The name of this content type
exports.NODE_TYPE_JOB = "job";



// Node extender for creating a job node.
//
exports.createJob = function (node, reqData) {

	node.type = exports.NODE_TYPE_JOB;

	if (reqData.hasOwnProperty("company") && reqData.company) {
		node.company = reqData.company;
	}

	logger.log.debug("job.createJob: In extender node = \n", node, "\nreqData = \n", reqData);

	return node;
}


// Node extender for creating a job node.
//
exports.updateJob = function (node, reqData) {

	// Safety to ensure the node type is correct.
	node.type = exports.NODE_TYPE_JOB;

	if (reqData.hasOwnProperty("company") && reqData.company) {
		node.company = reqData.company;
	}

	logger.log.debug("job.createJob: In extender node = \n", node, "\nreqData = \n", reqData);

	return node;
}


// -- Initialization ------------------------------------------------

// Register permissions with the role api.
roleapi.registerPermissions(exports.NODE_TYPE_JOB, job_perms);

