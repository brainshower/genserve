/*

Job Content Type

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



exports.createJob = function (node, reqData, uid) {

	logger.log.info("createJob: Arrived! node = \n", node);
	nodeapi.createNode (node, reqData, uid, 

		// Node Extender for setting content type and handling job-related fields
		function(node, reqData) {
			node.type = exports.NODE_TYPE_JOB;

			if (reqData.hasOwnProperty("company") && reqData.company) {
				node.company = reqData.company;
			}

			return node;
		}
	);
}



// -- Initialization ------------------------------------------------

// Register permissions with the role api.
roleapi.registerPermissions(exports.NODE_TYPE_JOB, job_perms);

