const express = require('express');
const router = express.Router();
const _ = require("underscore");
const filesize = require("filesize");
const path = require("path");
const axios = require("axios");
const pathHelper = require("../local_modules/path-helper/path-helper");
const fs = require("fs");
const https = require('https');

const artistProperties = require("../properties/artist.properties");
const characterProperties = require("../properties/character.properties");
const groupProperties = require("../properties/group.properties");
const languageProperties = require("../properties/language.properties");
const serieProperties = require("../properties/serie.properties");
const tagProperties = require("../properties/tag.properties");
const typeProperties = require("../properties/type.properties");

let properties = {
    artist: artistProperties,
    character: characterProperties,
    group: groupProperties,
    language: languageProperties,
    serie: serieProperties,
    tag: tagProperties,
    type: typeProperties
};

//collection files
router.get('/index', (req, res) => {
    let q = "";
    let type = "";
    let tag = "";
    let enable_search = true;

    if (req.query.type) {
        type = req.query.type;
    }

    if (req.query.q) {
        q = req.query.q;
    }

    Promise.all([
        metadataRemote.getMetadatasByIdCollectionAndType(req.cookies.id_collection, "artist"),
        metadataRemote.getMetadatasByIdCollectionAndType(req.cookies.id_collection, "character"),
        metadataRemote.getMetadatasByIdCollectionAndType(req.cookies.id_collection, "group"),
        metadataRemote.getMetadatasByIdCollectionAndType(req.cookies.id_collection, "language"),
        metadataRemote.getMetadatasByIdCollectionAndType(req.cookies.id_collection, "serie"),
        metadataRemote.getMetadatasByIdCollectionAndType(req.cookies.id_collection, "tag"),
        metadataRemote.getMetadatasByIdCollectionAndType(req.cookies.id_collection, "type"),
    ]).then((values) => {
        let [artists, characters, groups, languages, series, tags, types] = values;

        res.render("files/index/index", {
            enable_sidebar: true,
            enable_topbar : true,
            enable_search : true,
            active_menu_file: true,
            id_collection: req.cookies.id_collection,
            q : q,
            type : type,
            artists: artists,
            characters: characters,
            groups: groups,
            languages: languages,
            series: series,
            tag : tag,
            tags: tags,
            types : types
        });
    });
});

router.get('/search', (req, res) => {
    fileRemote
        .getCollectionFiles(req.cookies.id_collection, req.query)
        .then((rows) =>{
            //group by path
            let paths = {};

            let counter;

            let file_count = 0;

            _.each(rows, (row) => {
                if (!paths.hasOwnProperty(row.id_path)) {
                    paths[row.id_path] = {
                        id_path : row.id_path,
                        path    : row.path,
                        base_path: '',
                        files  : []
                    };

                    counter = 0;
                }

                let file = row;
                file.full_path = file.path + path.sep + file.filename;
                file.separator = (counter % 8 == 0 && counter > 0);
                file.human_size = filesize(file.size);

                paths[row.id_path]["base_path"] = file.path.replace(file.collection_path, "");
                paths[row.id_path]["files"].push(file);

                file_count++;
                counter++;
            });

            paths = _.sortBy(paths, (row) => {
                return row.path;
            });

            res.json({
                rows : paths,
                file_count: file_count
            });
        });
});

router.get('/:id_file/setMeta', (req, res) => {
    fileRemote
        .setMeta(req.params.id_file)
        .then(() => {
            res.json({status : "success" });
        });
});

//statistics
router.get('/statistics', (req, res) => {
    //get file information
    fileRemote.getFilesStatisticsByIdCollection(req.cookies.id_collection)
        .then((rows) => {
            res.render("files/statistics/statistics", {
                enable_sidebar: true,
                active_menu_file: true,
                rows : rows,
                id_collection: req.cookies.id_collection
            });
        });
});

//info
router.get('/:id_file/info', (req, res) => {
    fileRemote
        .getFileByIdFile(req.params.id_file)
        .then((row) => {
            row.full_path = row.path + path.sep + row.filename;

            Promise.all([
                metadataRemote.getMetadatasByType("artist", req.cookies.id_collection),
                metadataRemote.getMetadatasByType("character", req.cookies.id_collection),
                metadataRemote.getMetadatasByType("group", req.cookies.id_collection),
                metadataRemote.getMetadatasByType("language", req.cookies.id_collection),
                metadataRemote.getMetadatasByType("serie", req.cookies.id_collection),
                metadataRemote.getMetadatasByType("tag", req.cookies.id_collection),
                metadataRemote.getMetadatasByType("type", req.cookies.id_collection)
            ]).then((data) => {
                let [artists, characters, groups, languages, series, tags, types] = data;

                row.human_size = filesize(row.size);

                let metadata_clipboard = {
                    artists : fileRemote.joinInput(row.artists),
                    characters : fileRemote.joinInput(row.characters),
                    groups : fileRemote.joinInput(row.groups),
                    languages: fileRemote.joinInput(row.languages),
                    series: fileRemote.joinInput(row.series),
                    tags : fileRemote.joinInput(row.tags),
                    types : fileRemote.joinInput(row.types)
                };

                let metadatas = {
                    artists : artists,
                    characters : characters,
                    groups : groups,
                    languages: languages,
                    series: series,
                    tags : tags,
                    types : types
                };

                let metadatas_selected = {
                    artists : row.artists.map(function(value){ return value.id_metadata }),
                    characters : row.characters.map(function(value){ return value.id_metadata }),
                    groups : row.groups.map(function(value){ return value.id_metadata }),
                    languages: row.languages.map(function(value){ return value.id_metadata }),
                    series: row.series.map(function(value){ return value.id_metadata }),
                    tags : row.tags.map(function(value){ return value.id_metadata }),
                    types : row.types.map(function(value){ return value.id_metadata })
                }

                let options = {
                    artists :    fileRemote.prepareSelect(artists, "id_metadata", "name", metadatas_selected.artists),
                    characters : fileRemote.prepareSelect(characters, "id_metadata", "name", metadatas_selected.characters),
                    groups :     fileRemote.prepareSelect(groups, "id_metadata", "name", metadatas_selected.groups),
                    languages:   fileRemote.prepareSelect(languages, "id_metadata", "name", metadatas_selected.languages),
                    series:      fileRemote.prepareSelect(series, "id_metadata", "name", metadatas_selected.series),
                    tags :       fileRemote.prepareSelect(tags, "id_metadata", "name", metadatas_selected.tags),
                    types :      fileRemote.prepareSelect(types, "id_metadata", "name", metadatas_selected.types),
                }

                res.render("files/info/info", {
                    enable_sidebar: true,
                    active_menu_file: true,
                    id_collection: req.cookies.id_collection,
                    row: row,
                    tab : (req.query.tab == undefined)? '' : req.query.tab,
                    metadatas : metadatas,
                    options : options,
                    metadata_clipboard: metadata_clipboard,
                    properties: properties
                });
            });
        });
});

//metadata select
router.post('/:id_file/:type/select', (req, res) => {
    metadataRemote
        .deleteFilesMetadatasByIdFileAndType(req.params.id_file, req.params.type)//delete current metadatas for file
        .then(() => {
            let data = [];

            let current_metadatas = req.body.metadatas;

            if (current_metadatas != undefined) {
                //if only one item selected, force array
                if (!Array.isArray(current_metadatas)) {
                    current_metadatas = [current_metadatas];
                }

                for (let i = 0; i < current_metadatas.length; i++) {
                    data.push({
                        id_file : req.params.id_file,
                        id_metadata : current_metadatas[i]
                    });
                }

                //add metadatas to file in bulk
                fileRemote
                    .addMetadataBulk(data)
                    .then(() => {
                        res.redirect("/file/" + req.params.id_file + "/info?tab=" + req.params.type);
                    });
            } else {
                res.redirect("/file/" + req.params.id_file + "/info?tab=" + req.params.type);
            }
    });
});

//metadata by typing
router.post('/:id_file/:type/type', (req, res) => {
    Promise.all([
        metadataRemote.deleteFilesMetadatasByIdFileAndType(req.params.id_file, req.params.type), //delete current metadatas for file
        metadataRemote.bulkInsert(req.cookies.id_collection, req.params.type, req.body.metadatas) //insert typed metadatas if needed
    ]).then(() => {
        metadataRemote
            .getMetadatasByIdCollectionAndType(req.cookies.id_collection, req.params.type)
            .then((current_metadatas) => {
                let data = [];

                if (current_metadatas != undefined) {
                    let typed_metadatas = req.body.metadatas.split(",");

                    for (let i = 0; i < typed_metadatas.length; i++) {
                        for (let j = 0; j < current_metadatas.length; j++) {
                            if (typed_metadatas[i].toLowerCase() == current_metadatas[j].name.toLowerCase()) {
                                data.push({
                                    id_file : req.params.id_file,
                                    id_metadata : current_metadatas[j].id_metadata
                                });
                                break;
                            }
                        }
                    }

                    //add metadatas to file in bulk
                    fileRemote
                        .addMetadataBulk(data)
                        .then(() => {
                            res.redirect("/file/" + req.params.id_file + "/info?tab=" + req.params.type);
                        });
                } else {
                    res.redirect("/file/" + req.params.id_file + "/info?tab=" + req.params.type);
                }
            });
    });
});

//delete scrapping
router.get('/:id_file/delete_scrapping', (req, res) => {
    fileRemote
        .deleteScrappingForIdFile(req.params.id_file, req.cookies.id_collection)
        .then(() => {
            res.redirect("/file/" + req.params.id_file + "/info");
    });
});

//set rating
router.post('/:id_file/rating', (req, res) => {
    fileRemote
        .setFileRating(req.params.id_file, req.body.rating)
        .then(() => {
            res.json({
                "val": "ok"
            });
    });
});

module.exports = router;
