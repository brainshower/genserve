var roles = require("../users/role");
var logger = require("../global/logger");
var dbopen = require("../global/dbopen");
var globals = require("../global/globals");

//var dbname = globals.dbname;
var dbname = "test";


logger.log.info("Testing setUserRole...");
dbopen.openDB(dbname).then(

    function (dbObj) {
        roles.setUserRole({username:"mgenovese"}, "admin").then(
            function (success) {
                logger.log.info("Success, bitches!", success);


                roles.setUserRole({username: "mgenovese"}, "blogger").then(
                    function (success) {
                        logger.log.info("Success, bitches!", success);


                        roles.setUserRole({username: "mgenovese"}, "jobCreator").then(
                            function (success) {
                                logger.log.info("Success, bitches!", success);
                            },
                            function (fail) {
                                logger.log.warn("Failed, bitches!", fail);
                            }
                        );

                    },
                    function (fail) {
                        logger.log.warn("Failed, bitches!", fail);
                    }
                );

            },
            function (fail) {
                logger.log.warn("Failed, bitches!", fail);
            }
        );

  }

);
