var roles = require("../users/role");
var logger = require("../global/logger");
var dbopen = require("../global/dbopen");
var globals = require("../global/globals");

//var dbname = globals.dbname;
var dbname = "test";


/*

logger.log.info("Testing setPermissions...");
dbopen.openDB(dbname).then(

    function (dbObj) {
        roles.setPermissions("admin", "node", {create : "true", readown: "true"}).then(
            function (success) {
                logger.log.info("Success, bitches!", success);


                roles.setPermissions("admin", "jobs", {create : "false", readown: "false"}).then(
                    function (success) {
                        logger.log.info("Success, bitches!", success);


                        roles.setPermissions("admin", "jobs", {remove: true, readown: true}).then(
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


logger.log.info("Testing setUserRole...");
dbopen.openDB(dbname).then(

    function (dbObj) {
        roles.setUserRole("mgenovese", "admin").then(
            function (success) {
                logger.log.info("Success, bitches!", success);


                roles.setUserRole("mgenovese", "blogger").then(
                    function (success) {
                        logger.log.info("Success, bitches!", success);


                        roles.setUserRole("mgenovese", "jobCreator").then(
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
*/


logger.log.info("Testing getUserPerms...");
dbopen.openDB(dbname).then(

    function (dbObj) {

        roles.getUserPerms({uid: "542cc7807a59bd0b25c2b528"}, "").then(
            function (success) {
                logger.log.info("Success, bitches!", success);
            },
            function (fail) {
                logger.log.warn("Failed, bitches!", fail);
            }
        );

  }

);
