const fetch = require('node-fetch');

const BASEAPI = `https://quiet-sky-7620.fly.dev`;

class Forge {
	constructor(token, project) {
		this.project = project;
		this.header = { Authorization: `Bearer ${token}`, "Content-Type": "Application/json" };
		this.token = token;
		this.activityId = "8nWpMcyH5bge2LPW6hqDDAy9CKqQbC4f.CompoundStructLayerActivityv3+OneclickFixed";// "${AppNickName}.${ActivityName}+${ActivityAliasId}";
	}

	_header(token) {
		return { Authorization: `Bearer ${token}`, "Content-Type": "Application/json" };
	}

	async triggerJob(urn, fileurl, token) {
		const DAPluginToken = await this.get2leggedAuth();

		const body = {
			"activityId": this.activityId,
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
					"url": `${BASEAPI}/urns/${urn}`,
					"Headers":{
                        "Content-Type": `application/json`
                    }
				},
				"onProgress": {
					"verb": "post",
					"url": `${BASEAPI}/jobs/${urn}`,
					"Headers":{
                        "Content-Type": `application/json`
                    }
				},
				"onComplete": {
					"verb": "post",
					"url": `${BASEAPI}/jobs/${urn}`,
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

	async getFolderContents(folder) {
		const res = await fetch(`https://developer.api.autodesk.com/data/v1/projects/b.${this.project}/folders/${folder}/contents`, { headers: this.header });
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
		if (!body.results) return;
		// create temporary data, for now.
		// incorporate code from https://gist.github.com/JoaoMartins-Forge/15dead268936a8ac1d4cdd75e0fd45ac#file-connectmaterials-js-L60-L91
		body.results.category = "Floors";
		body.results["Structural Material"] = "Concrete, Cast In Situ",
		body.results["Dimensions"] = {
			"Area": "105.906 m^2",
			"Volume": "15.886 m^3",
			"Thickness": "150.000 mm",
			"Slope": "0.000 °",
			"Perimeter": "48000.000 mm",
			"Elevation at Top": "0.000 mm",
			"Elevation at Bottom": "-150.000 mm"
		}
	}

	async get2leggedAuth() {
		const url = `https://developer.api.autodesk.com/authentication/v1/authenticate`;
		const header = { 'Content-Type': 'application/x-www-form-urlencoded' };
		const clientid = "8nWpMcyH5bge2LPW6hqDDAy9CKqQbC4f";
		const secret = "9aolzHUfu7ggemvc";
		const body = `grant_type=client_credentials&client_id=${clientid}&client_secret=${secret}&scope=data:read`;
		let token = await fetch(url, { method: 'POST', headers: header, body: body });
		token = await token.json();
		return token.access_token;
	}


}

module.exports = Forge;

