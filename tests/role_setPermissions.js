var roles = require("../users/role");
var logger = require("../global/logger");
var dbopen = require("../global/dbopen");
var globals = require("../global/globals");

//var dbname = globals.dbname;
var dbname = "test";


logger.log.info("Testing setPermissions...");
dbopen.openDB(dbname).then(

    function (dbObj) {
        roles.setPermissions("user", "node", {create : true, readown: true, read: true}).then(
            function (success) {
                logger.log.info("Success, bitches!", success);
            },
            function (fail) {
                logger.log.warn("Failed, bitches!", fail);
            }
        );

        roles.setPermissions("user", "jobs", {create : false, readown: false, read: true}).then(
            function (success) {
                logger.log.info("Success, bitches!", success);
            },
            function (fail) {
                logger.log.warn("Failed, bitches!", fail);
            }
        );

        roles.setPermissions("user", "blog", {create : true, readown: true, read: false}).then(
            function (success) {
                logger.log.info("Success, bitches!", success);
            },
            function (fail) {
                logger.log.warn("Failed, bitches!", fail);
            }
        );

  }

);
