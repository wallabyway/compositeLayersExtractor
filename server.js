/*
BIM360 Revit Materials extractor

Open Revit file and extract the composite material layers and save as a JSON file

*/
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const fastify = require('fastify')({ logger: true })

let ze = null, bm = null;

// serve our static webpage
fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'ui'),
  prefix: '/', // optional: default '/'
})

function setCORS(reply) {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "POST");    
}

// INPUT: projectID, folderID, AccessToken
// OUTPUT: list of BIM360 files in the folder
fastify.get('/bim/list', async (request, reply) => {
    if (!request.query.project) return "INPUT: project, folder, token";
    setCORS(reply);
    bm = new BIM360utils(request.query.project, request.query.folder, request.query.token);
    const res = await bm.getFolderContents();
    return res;
});


// INPUT: filename
// OUTPUT: status of result (timeout after 30seconds)
fastify.get('/transfer', async (request, reply) => {
    if (!ze && !bm) return {status:`not-ready.  Use 'listcontents' first`};
    setCORS(reply);
    if (!request.query.filename) return "INPUT: filename";
    if (request.query.destFolder) bm.folder = request.query.destFolder;
    if (request.query.destProject) bm.project = request.query.destProject;

    try {
        const filename = request.query.filename;
        const resObj = await bm.createEmptyFile(filename);
        const status = await ze.extractFile(filename, resObj.destURL);
        let ress = null;
        if (request.query.lineage)
          ress = await bm.bumpVersion(resObj, request.query.lineage);
        else
          ress = await bm.createVersion(resObj);
    } catch(err) {
        return {status: err};
    }
})

// INPUT: filename
// OUTPUT: status of job
fastify.get('/status', async (request, reply) => {
    if (!request.query.filename) return "INPUT: filename";
    setCORS(reply);
    const id = request.query.filename;
    if (!id) return;
    return (id) ?  `{ "${id}" : "${ze.session[id]}" }` : "missing filename= parameter"
})

fastify.listen(process.env.PORT || 3000, "0.0.0.0", (err, address) => {
    if (err) throw err
    fastify.log.info(`server listening on ${address}`)
})
