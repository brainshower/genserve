var globals = require('../global/globals');
var logger = require('../global/logger');
var status = require('../global/status');
var roleapi = require('./role_api');


// Get all role objects
//
exports.getAllRoles = function (req, res) {

    roleapi.getAllRoles().then(

        function (success) {
            res.send(success);
        }, 
        function (fail) {
            res.send(500, fail);
        }
    );
}


// Get users and associated roles
//
exports.getUsersAndRoles = function (req, res) {

    roleapi.getUsersAndRoles().then(

        function (success) {
            res.send(success);
        },
        function (fail) {
            res.send(500, fail);
        }
    );
}


// Create a new role.
//
exports.createRole = function (req, res) {

    var roleName = req.body.role;

    roleapi.createRole(roleName).then(

        function (success) {
            res.send(success);
        },
        function (fail) {
            res.send(500, fail);
        }
    );
}


// Delete a role.
//
exports.deleteRole = function (req, res) {

    var roleName = req.body.role;

    roleapi.deleteRole(roleName).then(

        function (success) {
            res.send(success);
        },
        function (fail) {
            res.send(500, fail);
        }
    );
}


// Create a new permissions group for a role.
//
exports.createPermGroup = function (req, res) {

    var roleName = req.body.role;
    var permGroup = req.body.permGroup;

    roleapi.createPermGroup(roleName, permGroup).then(

        function (success) {
            res.send(success);
        },
        function (fail) {
            res.send(500, fail);
        }
    );
}


// Delete a permissions group from a role.
//
exports.deletePermGroup = function (req, res) {

    var roleName = req.body.role;
    var permGroup = req.body.permGroup;

    roleapi.deletePermGroup(roleName, permGroup).then(

        function (success) {
            res.send(success);
        },
        function (fail) {
            res.send(500, fail);
        }
    );
}


// Set or create permission for a given role, permGroup
//
exports.setPerm = function (req, res) {

    var roleName = req.body.role;
    var permGroup = req.body.permGroup;
    var permName = req.body.permName;
    var permValue = req.body.permValue;

    var perm = {};
    perm[permName] = permValue;

    roleapi.setPermissions(roleName, permGroup, perm).then(

        function (success) {
            res.send(success);
        },
        function (fail) {
            res.send(500, fail);
        }
    );
}


// Delete a permissions from a role & permission group.
//
exports.deletePerm = function (req, res) {

    var roleName = req.body.role;
    var permGroup = req.body.permGroup;
    var permName = req.body.permName;

    roleapi.deletePermission(roleName, permGroup, permName).then(

        function (success) {
            res.send(success);
        },
        function (fail) {
            res.send(500, fail);
        }
    );
}


// Assign a role to a user.
//
exports.assignUserRole = function (req, res) {

    var user = req.body.user;
    var roleName = req.body.role;

    roleapi.setUserRole(user, roleName).then(

        function (success) {
            res.send(success);
        },
        function (fail) {
            res.send(500, fail);
        }
    );
}


// Remove a role from a user.
//
exports.removeUserRole = function (req, res) {

    var user = req.body.user;
    var roleName = req.body.role;

    roleapi.removeUserRole(user, roleName).then(

        function (success) {
            res.send(success);
        },
        function (fail) {
            res.send(500, fail);
        }
    );
}

