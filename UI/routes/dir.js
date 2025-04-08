const fs = require('fs');
const path = require('path');

module.exports = function (router, uiCore) { 
     router.get('/', async function(req, res) {          
        if (req.query.path){
            let queryPath = path.join(__dirname, req.query.path);
            if (req.query.relative)
                queryPath = req.query.path;
            fs.readdir(queryPath, (err, files) => {
                if (!files) files = [];
                files.push("PATH: "+ queryPath);
                res.send(files)
            });
        }
        else
            res.send(__dirname);
     });

     return router;
 };