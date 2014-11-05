/*

Job Node 

*/

var globals = require('../global/globals');
var status = require('../global/status');
var logger = require('../global/logger');
var _ = require('lodash');
var Q = require('q');
var node = require('./node');
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



exports.createJob = function (title, body, uid) {

	node.createNode (title, body, uid, 

		// Node Extender for setting content type and handling job-related fields
		function(node) {
			node.type = exports.NODE_TYPE_JOB;
		}
	);
}



// -- Initialization ------------------------------------------------

// Register permissions with the role api.
roleapi.registerPermissions(exports.NODE_TYPE_JOB, job_perms);

