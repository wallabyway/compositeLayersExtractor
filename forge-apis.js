const fetch = require('node-fetch');

const BASEAPI = `https://quicktest.herokuapp.com`;

class Forge {
	constructor(token, project) {
		this.project = project;
		this.header = { Authorization: `Bearer ${token}`, "Content-Type": "Application/json" };
		this.token = token;
		this.activityId = "8nWpMcyH5bge2LPW6hqDDAy9CKqQbC4f.CompoundStructLayerActivity+dev";// "${AppNickName}.${ActivityName}+${ActivityAliasId}";
	}

	_header(token) {
		return { Authorization: `Bearer ${token}`, "Content-Type": "Application/json" };
	}

	async triggerJob(urn, fileurl) {
		const tokenTWO = await this.get2leggedAuth();

		const body = {
			"activityId": this.activityId,
			"arguments": {
				"inputFile": {
					"url": fileurl
				},
				"result": {
					"verb": "put",
					"url": `${BASEAPI}/urns/${urn}/data`,
				}
			}
		};

		const res = await fetch(`https://developer.api.autodesk.com/da/us-east/v3/workitems`, {
			method: 'POST', headers: this._header(tokenTWO), body: JSON.stringify(body)
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
