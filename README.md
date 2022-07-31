Comantag

Application to extract first image of a compressed file (rar, zip), create a thumbnail, and display them on a gallery list.

Made with electron (https://www.electronjs.org/).

Uses Unrar (https://www.rarlab.com/rar_add.htm)

Uses Unzip (http://infozip.sourceforge.net/)

To handle the opening of compressed files, you will need a program that can read cbr/cbz comics. This app uses Honeyview (https://www.bandisoft.com/honeyview/), and has hardcoded the path D:/Files/apps/HONEYVIEW-PORTABLE/Honeyview32.exe for the executable. If you need another app or path, modify the file main.js on the "open-file" section, and recompile it.

To experiment in the code, use:

npm install (to install dependencies)

npm start (to run server)

yarn dist (to create deployment)

Features:

Scrapping
![Scrapping](/repository/assets/scrapping.jpg?raw=true "Scrapping")

Gallery
![Gallery](/repository/assets/gallery.jpg?raw=true "Gallery")

Statistics
![Statistics](/repository/assets/statistics.jpg?raw=true "Statistics")