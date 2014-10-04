var bunyan = require('bunyan')

// Create logger
exports.log = bunyan.createLogger(
  {name: "API Server",
   stream: process.stdout,
   level: "debug",
   }
);
