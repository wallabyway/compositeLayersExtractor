const forgeApi = require('./forge-apis');

const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json')
const middlewares = jsonServer.defaults({ static: 'www', bodyParser: true });
server.use(middlewares);

const JOBS = [];
_forgeApi = null;

/* ENDPOINTS for JOB STATUS */

// Trigger a new job (designAutomation4Revit)
server.get('/job/trigger', async (req, res) => {
	if (!_forgeApi) {console.log('missing _forgeApi'); return;}
	const result = await _forgeApi.triggerJob(req.query.urn, req.query.fileurl, req.query.token);
	const workItemId = result.id;
	addreplaceURN("jobs", workItemId, {id:workItemId, workItemId:workItemId, urn:req.query.urn, status:"Queued", reportUrl:{}, stats:{}});
	res.jsonp(result);
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


server.post('/jobs/:urn', function (req, res) {
	req.body.workItemId = req.body.id;
	req.body.id = req.params.urn;
	if (!req.body.status) req.body.status = "inprogress"; 
	addreplaceURN("jobs", req.body.workItemId, req.body );
});

server.post('/urns/:urn', function (req, res) {
	req.body.id = req.params.urn;
	if (!_forgeApi) {console.log('missing _forgeApi'); return;}
	const results = _forgeApi.injectAdditionalProperties(req.params.urn, req.body)
	addreplaceURN("urns", req.params.urn, results );
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
	_forgeApi = new forgeApi(req.query.token, req.query.project);
	const result = await _forgeApi.getFolderContents(req.query.folder);
	res.jsonp(result);
});


// Start the web server
const PORT = process.env.PORT || 8000;

server.use(router);
server.listen(PORT, () => {
	console.log('JSON server running on port %d', PORT);
});
