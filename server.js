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
	this.forgeApi = new forgeApi(req.query.token);
	const result = await this.forgeApi.triggerJob(req.query.urn, req.query.fileurl, req.query.token);
	const workItemId = result.id;
	router.db.get("jobs").insert({id:workItemId, workItemId:workItemId, urn:req.query.urn, time : Date().toString(), status:"queued", reportUrl:"", stats:""}).write(); 
	res.jsonp(result);
});

server.post('/jobs/:urn', function (req, res) {
	req.body.workItemId = req.body.id;
	req.body.urn = req.params.urn;
	if (!req.body.status) req.body.status = "processing"; 
	req.body.time = Date().toString();
	console.info("job:",req.body);
	addreplaceURN("jobs", req.body.workItemId, req.body );
	res.sendStatus(200);
});

server.post('/urns/:urn', function (req, res) {
	req.body.id = req.params.urn;
	const _forgeApi = new forgeApi();
	const results = _forgeApi.injectAdditionalProperties(req.params.urn, req.body)
	addreplaceURN("urns", req.params.urn, results );
	res.sendStatus(200)
});

// add/replace keys[urn] = data
// make the URN's data mutable.
function addreplaceURN(key, urn, data ) {
	const chain = router.db.get(key); 
	const exists = chain.getById(urn);
	if (exists.value())
		chain.updateById(urn, data).write();
	else
		chain.insert(data).write();
}

// poll for job status.  it uses json server endpoint to serve job status.  ie.
// GET /job/status?urn=123 , returns: { status : 'complete' }

// set status 'onComplete' using json server, ie.
// POST /job/status?urn=123 , BODY: {'status':'complete'}



/* ENDPOINTS for ACC/BIM 360 utility endpoints */ 

// BIM 360 - get folder details
server.get('/bim/list', async (req, res) => {
	if (!req.query.folder) return;
	this.forgeApi = new forgeApi(req.query.token);
	const result = await this.forgeApi.getFolderContents(req.query.project, req.query.folder);
	res.jsonp(result);
});


// Start the web server
const PORT = process.env.PORT || 8000;

server.use(router);
server.listen(PORT, () => {
	console.info('JSON server running on port %d', PORT);
});
