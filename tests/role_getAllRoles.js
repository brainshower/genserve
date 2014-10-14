var roles = require("../users/role_api");
var logger = require("../global/logger");
var dbopen = require("../global/dbopen");
var globals = require("../global/globals");

//var dbname = globals.dbname;
var dbname = "test";

logger.log.info("Testing getAllRoles...");
dbopen.openDB(dbname).then(

    function (dbObj) {

        roles.getAllRoles().then(
            function (success) {
                logger.log.info("Success, bitches!", success);
            },
            function (fail) {
                logger.log.warn("Failed, bitches!", fail);
            }
        );

  }

);
