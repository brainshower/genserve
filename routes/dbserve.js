var dbopen = require('../global/dbopen');
var logger = require('../global/logger');



// Find an item by its mongo document ID
// 
exports.findById = function(db, col, req, res) {
    var id = req.params.id;
    var db = dbopen.getDB();

    logger.log.debug('Retrieving object: ', id);
    db.db.collection(col, function(err, collection) {
        collection.findOne({'_id':new db.BSON.ObjectID(id)}, function(err, item) {
            res.send(item);
        });
    });
};


// Get all items from the database collection.
// 
exports.findAll = function(db, col, req, res) {
    var db = dbopen.getDB();

    logger.log.debug('Retrieving all objects.');
    db.db.collection(col, function(err, collection) {
        collection.find().toArray(function(err, items) {
            res.send(items);
        });
    });
};


// Add an item to the database colletion.  (Yet untested)
// 
exports.addItem = function(db, col, req, res) {
    var db = dbopen.getDB();
    var wine = req.body;

    logger.log.debug('Adding object: ', wine);
    db.db.collection(col, function(err, collection) {
        collection.insert(wine, {safe:true}, function(err, result) {
            if (err) {
                res.send({'error':'An error has occurred'});
            } else {
                res.send(result[0]);
            }
        });
    });
}

 
// Updated an item in the database colletion.  (Yet untested)
// 
exports.updateItem = function(db, col, req, res) {
    var db = dbopen.getDB();
    var id = req.params.id;
    var wine = req.body;
    logger.log.debug('Updating object: ', id, wine);
    db.db.collection(col, function(err, collection) {
        collection.update({'_id':new db.BSON.ObjectID(id)}, wine, {safe:true}, function(err, result) {
            if (err) {
                logger.log.info(err, 'Error updating object: ', err);
                res.send({'error':'An error has occurred'});
            } else {
                res.send(wine);
            }
        });
    });
}

 
// Delete an item in the database colletion.  (Yet untested)
// 
exports.deleteItem = function(db, col, req, res) {
    var db = dbopen.getDB();
    var id = req.params.id;
    logger.log.info('Deleting object: ', id);
    db.db.collection(col, function(err, collection) {
        collection.remove({'_id':new db.BSON.ObjectID(id)}, {safe:true}, function(err, result) {
            if (err) {
                logger.log.info(err, 'Error deleting object', err);
                res.send({'error':'An error has occurred - ' + err});
            } else {
                res.send(req.body);
            }
        });
    });
}
