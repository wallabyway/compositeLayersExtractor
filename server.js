const forgeApi = require('./forge-apis');

const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json')
const middlewares = jsonServer.defaults({ static: 'www', bodyParser: true });
server.use(middlewares);

const JOBS = [];

/* ENDPOINTS for JOB STATUS */

// Trigger a new job (designAutomation4Revit)
server.get('/job/trigger', async (req, res) => {
	addreplaceURN("jobs", req.query.urn, {status:"inprogress"});
	const result = await this.forgeApi.triggerJob(req.query.urn, req.query.fileurl, req.query.token);
	res.jsonp(result);
});


// add/replace keys[urn] = data
function addreplaceURN(key, urn, data ) {
	const chain = router.db.get(key); 
	const exists = chain.getById(urn);
	if (exists.value())
		chain.updateById(urn, data).write();
	else
		chain.insert({ "id": urn, ...data}).write();
}

server.post('/urns/:urn', function (req, res) {
	addreplaceURN("jobs", req.params.urn, {"status":"complete"} );
	addreplaceURN("urns", req.params.urn, { "data" : req.body } );
	res.sendStatus(200)
});


// poll for job status.  it uses json server endpoint to serve job status.  ie.
// GET /job/status?urn=123 , returns: { status : 'complete' }

// set status 'onComplete' using json server, ie.
// POST /job/status?urn=123 , BODY: {'status':'complete'}



/* ENDPOINTS for ACC/BIM 360 utility endpoints */ 

// BIM 360 - get folder details
server.get('/bim/list', async (req, res) => {
	if (!req.query.folder) return;
	this.forgeApi = new forgeApi(req.query.token, req.query.project);
	const result = await this.forgeApi.getFolderContents(req.query.folder);
	res.jsonp(result);
});


// Start the web server
const PORT = process.env.PORT || 8000;

server.use(router);
server.listen(PORT, () => {
	console.log('JSON server running on port %d', PORT);
});