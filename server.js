"use strict";

var express = require('express'),
    dbopen = require('./global/dbopen'),
    globals = require('./global/globals'),
    logger = require('./global/logger'),
    node = require('./routes/node'),
    users = require('./users/users');
 
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



// Manage node API 
app.post('/node/all', node.findAllNodes);
app.post('/node/id/:id', node.findNodeById);
app.post('/node', node.createNode);
app.post('/node/update/:id', node.updateNode);
app.post('/node/delete/:id', node.deleteNode);

// Manage users API
//app.get('/users', users.findAll);
//app.get('/login/:id', users.findById);
//app.get('/users/email/:email', users.findByEmail);
app.post('/login/create', users.createUser); // Create a user
app.post('/login/auth', users.authUser); // Authenticate user
app.post('/login/reauth', users.reAuthUser); // Reauthenticate user
app.post('/login/logout', users.logoutUser); // Logout a user
//app.put('/login/:id', users.updateItem); // Change a user
//app.delete('/users:id', users.deleteItem);


// Start the web server.
//

logger.log.info("Opening the database.");
dbopen.openDB(globals.dbname).then(
  function (dbObj) {
      logger.log.info("Successfully opened the database.");
      logger.log.info('Listening on port 3000...');
      app.listen(3000);

      dbObj.close();
  }
);

