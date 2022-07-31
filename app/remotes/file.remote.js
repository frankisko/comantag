const database = require("../database");
const pathHelper = require("../local_modules/path-helper/path-helper");
const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const nativeImage = require('electron').nativeImage;
const _ = require("underscore");
const moment = require("moment");
const webp=require('webp-converter');

module.exports = class FileRemote {

    constructor() { }

    getFileByIdFile(id_file) {
        return new Promise((resolve, reject) => {
            database
                .select("files.*", "paths.path", "collections.name AS collection_name")
                .from("files")
                .innerJoin("paths", "files.id_path", "paths.id_path")
                .innerJoin("collections", "files.id_collection", "collections.id_collection")
                .where("files.id_file", id_file)
                .first()
                .then((row) => {
                    Promise.all([
                        metadataRemote.getMetadatasByIdFileAndType(id_file, "artist"),
                        metadataRemote.getMetadatasByIdFileAndType(id_file, "character"),
                        metadataRemote.getMetadatasByIdFileAndType(id_file, "group"),
                        metadataRemote.getMetadatasByIdFileAndType(id_file, "language"),
                        metadataRemote.getMetadatasByIdFileAndType(id_file, "serie"),
                        metadataRemote.getMetadatasByIdFileAndType(id_file, "tag"),
                        metadataRemote.getMetadatasByIdFileAndType(id_file, "type"),
                    ]).then((values) => {
                        row.artists = values[0];
                        row.characters = values[1];
                        row.groups = values[2];
                        row.languages = values[3];
                        row.series = values[4];
                        row.tags = values[5];
                        row.types = values[6];

                        resolve(row);
                    });
                });
        });
    }

    getCollectionFiles(id_collection, query_params) {
        return new Promise((resolve, reject) => {
            if (query_params == undefined) {
                query_params = null;
            }

            let query = database
                .select("files.*", "paths.path", "collections.path AS collection_path",
                    database.raw(`( SELECT COUNT(1)
                                    FROM files_metadatas INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'artist') AS artists_count`),
                    database.raw(`( SELECT COUNT(1)
                                    FROM files_metadatas INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'character') AS characters_count`),
                    database.raw(`( SELECT COUNT(1)
                                    FROM files_metadatas INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'group') AS groups_count`),
                    database.raw(`( SELECT COUNT(1)
                                    FROM files_metadatas INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'language') AS languages_count`),
                    database.raw(`( SELECT COUNT(1)
                                    FROM files_metadatas INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'serie') AS series_count`),
                    database.raw(`( SELECT COUNT(1)
                                    FROM files_metadatas INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'tag') AS tags_count`),
                    database.raw(`( SELECT COUNT(1)
                                    FROM files_metadatas INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'type') AS types_count`))
                .from("files")
                .innerJoin("paths", "files.id_path", "paths.id_path")
                .innerJoin("collections", "files.id_collection", "collections.id_collection")
                .where("files.id_collection", id_collection)
                .orderBy([
                    { column: 'paths.path', order: 'asc' },
                    { column: 'files.name', order: 'asc' }
                ]);

                if (query_params != null && query_params.text) {
                    switch(query_params.type) {
                        case "filename":
                            query.andWhere('files.name', 'like', '%' + query_params.text + '%');
                            break;
                        case "path" :
                            query.andWhere('paths.path', 'like', '%' + query_params.text + '%');
                            break;
                    }
                }

            //visibility
            if (query_params != null && query_params.visibility != null && query_params.visibility != "") {
                if (query_params.visibility == "viewed") {
                    query.andWhere('files.view_count', '>', 0);
                }

                if (query_params.visibility == "not_viewed") {
                    query.andWhere('files.view_count', 0);
                }
            }

            //rating
            if (query_params != null && query_params.rating != null && query_params.rating != "") {
                query.andWhere('files.rating', 'in', query_params.rating.split(","));
            }

            //metadata filters
            let metadatas_filters = ["artists", "characters", "groups", "languages", "series", "tags", "types"]

            if (query_params != null) {
                let metadatas_tmp = "";

                for (let i = 0; i < metadatas_filters.length; i++) {
                    if (query_params[metadatas_filters[i]] != null && query_params[metadatas_filters[i]] != "") {
                        if (metadatas_tmp == "") {
                            metadatas_tmp = query_params[metadatas_filters[i]];
                        } else {
                            metadatas_tmp += "," + query_params[metadatas_filters[i]];
                        }
                    }
                }

                if (metadatas_tmp != "") {
                    let metadatas = metadatas_tmp.split(",");

                    for (let i = 0; i < metadatas.length; i++) {
                        query.andWhereRaw(`(
                            SELECT count(1)
                            FROM files_metadatas
                            WHERE files.id_file = files_metadatas.id_file
                            AND files_metadatas.id_metadata = ( ${metadatas[i]} )
                            ) = 1`);
                    }
                }
            }

            query.then((rows) => {
                resolve(rows);
            });
        });
    }

    getFilesStatisticsByIdCollection(id_collection) {
        return new Promise((resolve, reject) => {
            database
                .select(
                    "files.*",
                    database.raw(`(SELECT COUNT(1)
                                    FROM files_metadatas
                                    INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'artist'
                                  ) AS artists_count`
                    ),
                    database.raw(`(SELECT COUNT(1)
                                    FROM files_metadatas
                                    INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'character'
                                  ) AS characters_count`
                    ),
                    database.raw(`(SELECT COUNT(1)
                                    FROM files_metadatas
                                    INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'group'
                                  ) AS groups_count`
                    ),
                    database.raw(`(SELECT COUNT(1)
                                    FROM files_metadatas
                                    INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'language'
                                  ) AS languages_count`
                    ),
                    database.raw(`(SELECT COUNT(1)
                                    FROM files_metadatas
                                    INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'serie'
                                  ) AS series_count`
                    ),
                    database.raw(`(SELECT COUNT(1)
                                    FROM files_metadatas
                                    INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'tag'
                                  ) AS tags_count`
                    ),
                    database.raw(`(SELECT COUNT(1)
                                    FROM files_metadatas
                                    INNER JOIN metadatas ON files_metadatas.id_metadata = metadatas.id_metadata
                                    WHERE files.id_file = files_metadatas.id_file
                                    AND metadatas.type = 'type'
                                  ) AS types_count`
                    )
                )
                .from("files")
                .where("files.id_collection", id_collection)
                .orderBy([
                    { column: 'files.name', order: 'asc' }
                ]).then((rows) => {
                    resolve(rows);
                });
        });
    }

    getFileToScrape(id_collection) {
        return new Promise((resolve, reject) => {
            database
                .select("files.*", "paths.path")
                .from("files").innerJoin("paths", "files.id_path", "paths.id_path")
                .where("files.id_collection", id_collection)
                .andWhere("files.scrapped", 0)
                .first()
                .then((file) => {
                    if (file == undefined) {
                        //no more files to scrape
                        resolve("done");
                    } else {
                        const stats = fs.statSync(path.join(file.path, file.filename));
                        let info = {
                            size: stats.size
                        };

                        this.setFileInfo(file, info)
                            .then(() => {
                                resolve(file);
                            });
                    }
                });
        });
    }

    setFileInfo(file, info) {
        return new Promise((resolve, reject) => {
            database('files')
                .where("id_file", file.id_file)
                .update(info)
                .then(() => {
                    resolve("ok");
                });
        });
    }

    scrapeFile(id_collection) {
        return new Promise((resolve, reject) => {
            this.getFileToScrape(id_collection)
                .then((file) => {
                    if (file == "done") {
                        rimraf.sync(path.join(__dirname, '..', 'public', 'tmp'));

                        resolve("done");
                    } else {
                        let extension = file.filename.split('.').pop();

                        let decompressor = null;

                        switch(extension) {
                            case "cbz":
                            case "zip":
                                decompressor = unzipRemote;
                            break;
                            case "rar":
                            case "cbr":
                                decompressor = unrarRemote;
                            break;
                        }

                        console.log("decompressing: " + file.id_file + "->" + path.join(file.path, file.filename));

                        decompressor.extractFirst(file).then((extracted_info)=> {
                            console.log("extracted info", extracted_info)

                            const info = {
                                scrapped: 1,
                                pages: extracted_info.pages
                            };

                            if (extracted_info.first_file != "") {
                                //move to location
                                let oldPath = path.join(__dirname, '..', 'public', 'tmp', extracted_info.first_file).replace(path.sep + 'app.asar', '');

                                let tempFilename = file.id_file.toString() + "_tmp" + path.extname(extracted_info.first_file);
                                let tempPath = path.join(__dirname, '..', 'public', 'collections', id_collection.toString(), 'thumbnails',
                                                        tempFilename).replace(path.sep + 'app.asar', '');;

                                fs.renameSync(oldPath, tempPath);

                                if (path.extname(extracted_info.first_file) == ".webp") {
                                    let tempPathPNG = path.join(__dirname, '..', 'public', 'collections', id_collection.toString(), 'thumbnails',
                                        file.id_file.toString() + "_tmp.png")
                                        .replace(path.sep + 'app.asar', '');

                                    //changed node_modules/webp-converter/src/dwebp.js
                                    //for windows, forced path to this
                                    //return path.join("D:\\", "xampp", "htdocs", "comantag", "node_modules", "webp-converter", "bin", "libwebp_win64", "bin", "dwebp.exe")
                                    const result = webp.dwebp(tempPath, tempPathPNG, "-o");

                                    result.then((response) => {
                                        this.createThumbnail(tempPathPNG, file.id_file);
                                        fs.unlinkSync(tempPath);

                                        this.setFileInfo(file, info)
                                        .then(() => {
                                            resolve(file);
                                        });
                                    });
                                } else {
                                    this.createThumbnail(tempPath, file.id_file);

                                    this.setFileInfo(file, info)
                                        .then(() => {
                                            resolve(file);
                                        });
                                }
                            } else {
                                fs.copyFileSync(path.join(__dirname, '..', 'public', 'images', 'no_preview.jpg').replace(path.sep + 'app.asar', ''),
                                                path.join(__dirname, '..', 'public', 'collections', id_collection.toString(), 'thumbnails', file.id_file.toString() + ".jpg").replace(path.sep + 'app.asar', '')
                                );

                                this.setFileInfo(file, info)
                                        .then(() => {
                                            resolve(file);
                                        });
                            }
                        });
                    }
                });
        });
    }

    createThumbnail(tempPath, id_file) {
        //resize image
        let image = nativeImage.createFromPath(tempPath);
        image = image.resize({width: 300});
        let buffer = image.toJPEG(75);

        fs.writeFileSync(path.join(path.dirname(tempPath), id_file.toString() + ".jpg"), buffer);

        //remove temp image
        fs.unlinkSync(tempPath);
    }

    deleteFilesByIdCollection(id_collection) {
        return new Promise((resolve, reject) => {
            database('files')
                .where({'id_collection': id_collection})
                .delete()
                .then(() => {
                    resolve("delete files");
                });
        });
    }

    markAsScrapped(id_files) {
        return new Promise((resolve, reject) => {
            if (id_files.length > 0) {
                database('files')
                    .whereIn("id_file", id_files)
                    .update({
                        scrapped : 1
                    }).then(() => {
                        resolve("ok");
                    });
            } else {
                resolve("ok");
            }
        });
    }

    markCollectionFilesAsPendingScrapped(id_collection) {
        return new Promise((resolve, reject) => {
            database('files')
                .where("id_collection", id_collection)
                .update({
                    scrapped : 0
                }).then(() => {
                    resolve("ok");
                });
        });
    }

    markFileAsPendingScrapped(id_file) {
        return new Promise((resolve, reject) => {
            database('files')
                .where("id_file", id_file)
                .update({
                    scrapped : 0
                }).then(() => {
                    resolve("ok");
                });
        });
    }

    markFilesAsPendingScrapped(id_files) {
        return new Promise((resolve, reject) => {
            database('files')
                .whereIn("id_file", id_files)
                .update({
                    scrapped : 0
                }).then(() => {
                    resolve("ok");
                });
        });
    }

    insertNewFiles(data) {
        return new Promise((resolve, reject) => {
            database
                .batchInsert('files', data, 100)
                .then(() => {
                    resolve("ok");
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    deleteObsoleteFiles(id_files, id_collection) {
        return new Promise((resolve, reject) => {
            if (id_files.length > 0) {
                database("files")
                    .whereIn("id_file", id_files)
                    .delete()
                    .then(() => {
                        Promise.all([
                            metadataRemote.deleteFilesMetadatasByIdFiles(id_files),
                            this.deleteScrappingForIdFiles(id_files, id_collection)
                        ]).then(()=> {
                            resolve("ok");
                        });
                });
            } else {
                resolve("ok");
            }
        });
    }

    countFiles(id_collection) {
        return new Promise((resolve, reject) => {
            database("files")
                .where("id_collection", id_collection)
                .count("id_file as count")
                .then((rows) => {
                    resolve(rows[0].count);
                });
        });
    }

    countPendingFiles(id_collection) {
        return new Promise((resolve, reject) => {
            database("files")
                .where("id_collection", id_collection)
                .andWhere("scrapped", 0)
                .count("id_file as count")
                .then((rows) => {
                    resolve(rows[0].count);
                });
        });
    }

    countFilesByCollection() {
        return new Promise((resolve, reject) => {
            database("files")
                .select(database.raw("id_collection, count(1) AS total"))
                .groupBy("id_collection")
                .then((rows) => {
                    resolve(rows);
                });
        });
    }

    setMeta(id_file) {
        return new Promise((resolve, reject) => {
            let timestamp = moment().unix();

            database('files')
                .where("id_file", id_file)
                .update({
                    "last_viewed" : timestamp
                })
                .increment("view_count", 1)
                .then(() => {
                    resolve("ok");
                });
        });
    }

    addMetadataBulk(data) {
        return new Promise((resolve, reject) => {
            database
                .batchInsert('files_metadatas', data, 100)
                .then(() => {
                    resolve("ok");
                });
        });
    }

    deleteScrappingForIdFile(id_file, id_collection) {
        return new Promise((resolve, reject) => {
            const thumbnails_folder = pathHelper.getTmpFolder(id_collection);

            Promise.all([
                fs.unlink(path.join(thumbnails_folder, id_file.toString() + '.jpg'), (err) => {}),
                this.markFileAsPendingScrapped(id_file)
            ]).then(() => {
                resolve("ok");
            });
        });
    }

    deleteScrappingForIdFiles(id_files, id_collection) {
        return new Promise((resolve, reject) => {
            const thumbnails_folder = pathHelper.getThumbnailsFolder(id_collection);

            let promises = [];

            if (id_files.length > 0) {
                for (let i = 0; i < id_files.length; i++) {
                    promises.push(fs.unlink(path.join(thumbnails_folder, id_files[i].toString() + '.jpg'), (err) => {}));
                }
            }

            promises.push(this.markFilesAsPendingScrapped(id_files));

            Promise.all([
                promises
            ]).then(() => {
                resolve("ok");
            });
        });
    }

    setFileRating(id_file, rating) {
        return new Promise((resolve, reject) => {
            database('files')
                .where("id_file", id_file)
                .update({"rating": rating})
                .then(() => {
                    resolve("ok");
                });
        });
    }

    joinInput(data) {
        return _.map(data, (value) => {
            return value.name;
        }).join(",");
    }

    prepareSelect(rows, id, text, selected) {
        return rows.map(function(row) {
            return {
                "value": row[id],
                "text": row[text],
                "selected": selected.indexOf(row[id]) != -1
            }}
        );
    }

    setSelected(catalog, rows) {
        for (let i = 0; i < catalog.length; i++) {
            let found = false;

            for (let j = 0; j < rows.length; j++) {
                if (catalog[i]["id_metadata"] == rows[j]["id_metadata"]) {
                    found = true;
                    break;
                }
            }

            catalog[i].selected = (found)? true : false;
        }

        return catalog;
    }

    saveUrl(id_file, url) {
        return new Promise((resolve, reject) => {
            let data = {
                url : url.trim()
            };

            database("files")
                .where("id_file", id_file)
                .update(data)
                .then(() => {
                    resolve("ok");
                });
        });
    }

}