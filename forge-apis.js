const fetch = require('node-fetch');

const config = {
	CLIENTID : process.env.FORGE_CLIENTID,
	SECRET : process.env.FORGE_SECRET,
	ACTIVITYID : process.env.FORGE_ACTIVITYID,
	BASEAPI : process.env.BASEAPI //`https://quiet-sky-7620.fly.dev`
};

console.error(config);

class Forge {
	constructor(token) {
		this.header = { Authorization: `Bearer ${token}`, "Content-Type": "Application/json" };
		this.token = token;
	}

	_header(token) {
		return { Authorization: `Bearer ${token}`, "Content-Type": "Application/json" };
	}

	async triggerJob(urn, fileurl, token) {
		const DAPluginToken = await this.get2leggedAuth();

		const body = {
			"activityId": config.ACTIVITYID,
			"arguments": {
				"inputFile": {
					"url": fileurl,
					"Headers":{
                        "Authorization": `Bearer ${token}}`
                    }
				},
				"params": {
					"verb": "get",
					"url": `data:application/json,{'urn':'${urn}','options':{'walls':true,'floors':true,'ceilings':true,'extrusionroof':true,'footprintroof':true}}`
				},
				"result": {
					"verb": "post",
					"url": `${config.BASEAPI}/urns/${urn}`,
					"Headers":{
                        "Content-Type": `application/json`
                    }
				},
				"onProgress": {
					"verb": "post",
					"url": `${config.BASEAPI}/jobs/${urn}`,
					"Headers":{
                        "Content-Type": `application/json`
                    }
				},
				"onComplete": {
					"verb": "post",
					"url": `${config.BASEAPI}/jobs/${urn}`,
					"Headers":{
                        "Content-Type": `application/json`
                    }
				}				
			}
		};

		const res = await fetch(`https://developer.api.autodesk.com/da/us-east/v3/workitems`, {
			method: 'POST', headers: this._header(DAPluginToken), body: JSON.stringify(body)
		});
		const result = await res.json();
		return result;
	}

	async getFolderContents(project, folder) {
		const res = await fetch(`https://developer.api.autodesk.com/data/v1/projects/b.${project}/folders/${folder}/contents`, { headers: this.header });
		const jres = await res.json();
		if (!jres.included) return jres;

		let result = jres.included.map(i => {
			return ({
				urn: Buffer.from(i.id).toString('base64'),
				filename: i.attributes.displayName,
				size: i.attributes.storageSize,
				lastModifiedTime: i.attributes.lastModifiedTime,
				lineage: i.relationships.item.data.id,
				version: i.attributes.versionNumber,
				datetime: (new Date(i.attributes.lastModifiedTime)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
				url: `https://developer.api.autodesk.com/oss/v2/buckets/wip.dm.prod/objects/${i.relationships.storage.data.id.split('/')[1]}`
			})
		});

		result.sort((a, b) => {
			return (b.lastModifiedTime < a.lastModifiedTime) ? -1 : 1
		});

		return result;
	}


	injectAdditionalProperties(urn, body) {
		// incorporate code from https://gist.github.com/JoaoMartins-Forge/15dead268936a8ac1d4cdd75e0fd45ac#file-connectmaterials-js-L60-L91
		const props = {
			"class":"Internal Wall",
			"ifcmaterial":"Precast Concrete",
		}
		if (!body.results) return;
		return Object.assign(body, props);
	}

	async get2leggedAuth() {
		const url = `https://developer.api.autodesk.com/authentication/v1/authenticate`;
		const header = { 'Content-Type': 'application/x-www-form-urlencoded' };
		const body = `grant_type=client_credentials&client_id=${config.CLIENTID}&client_secret=${config.SECRET}&scope=data:read`;
		let token = await fetch(url, { method: 'POST', headers: header, body: body });
		token = await token.json();
		console.info('got token',token);
		return token.access_token;
	}


}

module.exports = Forge;

