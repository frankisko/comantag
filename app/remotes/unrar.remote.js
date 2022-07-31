const fs = require("fs");
const path = require("path");
const pathHelper = require("../local_modules/path-helper/path-helper");
const { exec } = require('child_process');
const os = require("os");
const { orderBy } = require('natural-orderby');

module.exports = class UnrarRemote {

    constructor() {
    }

    getUnrar() {
        let unrar_exe = "UnRAR";
        if (os.platform() == "win32") {
            unrar_exe += ".exe";
        }

        return path.join(__dirname, '..', 'libs', 'unrar', unrar_exe).replace(path.sep + 'app.asar', '');
    }

    extractFirst(file) {
        return new Promise((resolve, reject) => {
            //console.log("start get info");

            const tmp_folder = pathHelper.getTmpFolder();

            if (!fs.existsSync(tmp_folder)) {
                fs.mkdirSync(tmp_folder);
            }

            let unrar_exe = this.getUnrar();

            const list_command = unrar_exe +
                            ' lb ' +
                            ' "' + path.join(file.path, file.filename) + '"';

            console.log("list command: " + list_command);

            exec(list_command, (error, stdout, stderr) => {
                //console.log(error);
                //console.log(stdout);
                //console.log(stderr);

                let lines = stdout.toString().split("\r\n");

                lines = orderBy(lines);

                let first_file = "";
                let number_files = 0;

                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].match(/(jpg|jpeg|png|webp)$/i) ) {
                        if (first_file == "") {
                            first_file = lines[i];
                        }

                        number_files++;
                    }
                }

                if (first_file != "") {
                    const extract_command = unrar_exe +
                                      ' e ' +
                                      ' "' + path.join(file.path, file.filename) + '"' +
                                      ' "' + first_file + '"' +
                                      ' "' + tmp_folder + '"';

                    console.log("extract command: " + extract_command);

                    exec(extract_command, (error, stdout, stderr) => {
                        //console.log(error);
                        //console.log(stdout);
                        //console.log(stderr);

                        if (error == null) {
                            resolve({
                                first_file: path.basename(first_file),
                                pages: number_files
                            });
                        } else {
                            console.log(error);
                            //console.log(stdout);
                            //console.log(stderr);

                            resolve("");
                        }
                    });
                } else {
                    resolve("");
                }
            });
        });
    }
}