const fetch = require('node-fetch');
const classesInRevit = require('./class-mapping.json');

const config = {
	CLIENTID: process.env.FORGE_CLIENTID,
	SECRET: process.env.FORGE_SECRET,
	ACTIVITYID: process.env.FORGE_ACTIVITYID,
	BASEAPI: process.env.BASEAPI //`https://quiet-sky-7620.fly.dev`
};

class Forge {
	constructor(token) {
		this.header = { Authorization: `Bearer ${token}`, "Content-Type": "Application/json" };
		this.token = token;
		this.twoleggedtoken = "";
	}

	_header(token) {
		return { Authorization: `Bearer ${token}`, "Content-Type": "Application/json" };
	}

	async triggerJob(urn, viewable, fileurl, token) {
		const DAPluginToken = await this.get2leggedAuth();

		const body = {
			"activityId": config.ACTIVITYID,
			"arguments": {
				"inputFile": {
					"url": fileurl,
					"Headers": {
						"Authorization": `Bearer ${token}}`
					}
				},
				"params": {
					"verb": "get",
					"url": `data:application/json,{'urn':'${urn}', 'viewname':'${viewable}','options':{'walls':true,'floors':true,'ceilings':true,'extrusionroof':true,'footprintroof':true}}`
				},
				"result": {
					"verb": "post",
					"url": `${config.BASEAPI}/urns/${urn + '|' + viewable}`,
					"Headers": {
						"Content-Type": `application/json`
					}
				},
				"onProgress": {
					"verb": "post",
					"url": `${config.BASEAPI}/jobs/${urn}`,
					"Headers": {
						"Content-Type": `application/json`
					}
				},
				"onComplete": {
					"verb": "post",
					"url": `${config.BASEAPI}/jobs/${urn}`,
					"Headers": {
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
				urn: Buffer.from(i.id).toString('base64').replaceAll('/', '_'),
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

	calcHistogram(urn) {
		const histogram = new Map();
		urn.map(i => {
			const key = i.revitmaterial;
			if (histogram.has(key)) {
				const item = histogram.get(key);
				item.ids.push(i.hostid);
				if (item.materialareaqty) item.materialareaqty += i.materialareaqty;
				if (item.materialvolumeqty) item.materialvolumeqty += i.materialvolumeqty;
			} else {
				histogram.set(key, { ids: [i.hostid], material: key, volume: i.materialvolumeqty, area: i.materialareaqty });
			}
		});
		return histogram;
	}

	async deduplicateMaterials(urn, body) {
		const deduplicated = {
			"id": urn,
			"urn": urn,
			"results": []
		}

		if (!body.results) return;

		body.results.forEach(material => {
			let materialIFCClass = Object.keys(classesInRevit).includes(material.revitclass) ? classesInRevit[material.revitclass].ifcclass : "OTHER";
			let currentMaterial = deduplicated.results.find(m => m.CLASS === materialIFCClass && m.IFCMATERIAL === material.revitmaterial)
			if (!!currentMaterial) {
				switch (currentMaterial.QTY_TYPE) {
					case "M2":
						currentMaterial.QUANTITY += material.materialareaqty;
						break;
					case "M3":
						currentMaterial.QUANTITY += material.materialvolumeqty;
						break;
					default:
						currentMaterial.QUANTITY += 1;
						break;
				}
			}
			else {
				let newMaterial = {
					CLASS: materialIFCClass,
					IFCMATERIAL: material.revitmaterial
				};
				newMaterial.QTY_TYPE = Object.keys(classesInRevit).includes(material.revitclass) ? classesInRevit[material.revitclass].Quantity : "NO MAPPING";
				switch (newMaterial.QTY_TYPE) {
					case "M2":
						newMaterial.QUANTITY = material.materialareaqty;
						break;
					case "M3":
						newMaterial.QUANTITY = material.materialvolumeqty;
						break;
					default:
						newMaterial.QUANTITY = 1;
						break;
				}
				deduplicated.results.push(newMaterial);
			}
		});
		return deduplicated;
	}

	async getModelViewables(urn, url) {
		this.twoleggedtoken = await this.get2leggedAuth();

		const res = await fetch(`https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/metadata`, {
			method: "GET",
			headers: this._header(this.twoleggedtoken)
		});

		const jres = await res.json();

		let result = jres.data.metadata.map(i => {
			return ({
				urn: urn,
				filename: i.name,
				guid: i.guid,
				url: url
			})
		});

		return result;
	}

	async get2leggedAuth() {
		const url = `https://developer.api.autodesk.com/authentication/v1/authenticate`;
		const header = { 'Content-Type': 'application/x-www-form-urlencoded' };
		const body = `grant_type=client_credentials&client_id=${config.CLIENTID}&client_secret=${config.SECRET}&scope=data:read`;
		let token = await fetch(url, { method: 'POST', headers: header, body: body });
		token = await token.json();
		return token.access_token;
	}

}

module.exports = Forge;
