"use strict";

var express = require('express'),
    dbopen = require('./global/dbopen'),
    globals = require('./global/globals'),
    logger = require('./global/logger'),
    node = require('./routes/node'),
    nodeapi = require('./routes/node_api'),
    users = require('./users/users'),
    roles = require('./users/roles'),
    roleapi = require('./users/role_api'),
    util = require('./global/utility');

var job = require('./routes/job');
 
var app = express();

logger.log.info("Log initalized.");
 
app.configure(function () {
    app.use(express.logger('dev'));     /* 'default', 'short', 'tiny', 'dev' */
    app.use(express.bodyParser());
});

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    //res.setHeader('Access-Control-Allow-Credentials', false);

    // Pass to next layer of middleware
    next();
});


// Setup all the API routes ---------------------------------------------------------------

// Node API: Use the base API functions for executing the node commands.
// The node extender function does not exist for basic nodes, so the function paramter is set to null.
app.post('/node',             util.curry(node.createNode, null) );
app.post('/node/update/:id',  util.curry(node.updateNode, null) );
app.post('/node/delete/:id',  util.curry(node.deleteNode, null) );
app.post('/node/all',         util.curry(node.findAllNodes, null) );
app.post('/node/id/:id',      util.curry(node.findNodebyId, null) );

// Job - testing
app.post('/job',              util.curry(node.createNode, job.createJob) );
app.post('/job/update/:id',   util.curry(node.updateNode, job.updateJob) );

// User and authentication API
app.post('/login/create', users.createUser); // Create a user
app.post('/login/auth', users.authUser); // Authenticate user
app.post('/login/reauth', users.reAuthUser); // Reauthenticate user
app.post('/login/logout', users.logoutUser); // Logout a user

// Role API
app.get('/admin/role/getroles', roles.getAllRoles); // Get all the role objects.
app.get('/admin/role/getusers', roles.getUsersAndRoles); // Get all users and associated role objects.
app.post('/admin/role/create', roles.createRole); // Create a new role 
app.post('/admin/role/delete', roles.deleteRole); // Delete a role 
app.post('/admin/role/user/assign', roles.assignUserRole); // Assign a role to a user
app.post('/admin/role/user/remove', roles.removeUserRole); // Remove a role from a user
app.post('/admin/role/perm/set', roles.setPerm); // Set a permission
// The following role operations are not exposed to the API.  Permission groups and permissions are defined programmatically by other entities.
//app.post('/admin/role/permgroup/create', roles.createPermGroup); // Create a permissions group
//app.post('/admin/role/permgroup/delete', roles.deletePermGroup); // Delete a permissions group
//app.post('/admin/role/perm/delete', roles.deletePerm); // Delete a permission


// Start the web server.
//
logger.log.info("Opening the database.");
dbopen.openDB(globals.dbname).then(
    function (dbObj) {
        logger.log.info("Successfully opened the database.");

        roleapi.init().then(
            function() {
                logger.log.info("Synchronized all roles and permissions from the database.");

                logger.log.info('Listening on port 3000...');
                app.listen(3000);
                dbObj.close();
            }
        );
    }
);

