const path = require("path");

module.exports = {
    getCollectionFolder : function(id_collection) {
        return path.join(__dirname, '..', '..', 'public', 'collections', id_collection.toString()).replace(path.sep + 'app.asar', '');
    },
    getTmpFolder : function() {
        return path.join(__dirname, '..', '..', 'public', 'tmp').replace(path.sep + 'app.asar', '');
    },
    getThumbnailsFolder : function(id_collection) {
        return path.join(__dirname, '..', '..', 'public', 'collections', id_collection.toString(), 'thumbnails').replace(path.sep + 'app.asar', '');
    }
}