const fetch = require('node-fetch');
const classesInMD = require('./class-mapping.json');

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
					"url": `data:application/json,{'urn':'${urn}','options':{'walls':true,'floors':true,'ceilings':true,'extrusionroof':true,'footprintroof':true}}`
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


	async injectAdditionalProperties(urn, body) {
		// incorporate code from https://gist.github.com/JoaoMartins-Forge/15dead268936a8ac1d4cdd75e0fd45ac#file-connectmaterials-js-L60-L91
		// const props = {
		// 	"class": "Internal Wall",
		// 	"ifcmaterial": "Precast Concrete",
		// }
		if (!body.results) return;

		let modelViewable = urn.split('|');

		this.twoleggedtoken = await this.get2leggedAuth();

		// const metaDataGuid = await this.getMetadataGuid(urn);

		await this.getHyerarchyMap(modelViewable[0], modelViewable[1]);

		//now we add nodespath to jsonserver

		let elementswithProperties = [];

		for (const dbId of Object.keys(this.nodesPath.dbids)) {
			const elementswithrequiredprops = await this.getLeafNodeProperties(modelViewable[0], modelViewable[1], dbId);
			elementswithProperties.push(...elementswithrequiredprops);
		}

		elementswithProperties.
			forEach(elementwithProperties => {
				elementwithProperties.class = Object.keys(classesInMD).includes(elementwithProperties.class) ? classesInMD[elementwithProperties.class].ifcclass : 'OTHER';
				let currentelementlayers = body.results.find(layer => layer.uniqueId === elementwithProperties.externalId);

				if (!!currentelementlayers) {
					elementwithProperties.layers = currentelementlayers.layers;

					elementwithProperties.layers.forEach(layer => {
						layer.width = (layer.width * 304.8) + ' mm';
					})
				}
			})

		return elementswithProperties;
		// return Object.assign(body, props);
	}

	async getLeafNodeProperties(urn, guid, objectid) {
		let responsejson = {};

		while (true) {
			const res = await fetch(`https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/metadata/${guid}/properties?objectid=${objectid}`, {
				method: "GET",
				headers: this._header(this.twoleggedtoken)
			});

			responsejson = await res.json();
			let responseStatus = responsejson.result;

			if (responseStatus === 'success') {
				await sleep(1000);
			}
			else {
				break;
			}
		}

		let requiredpropselements = responsejson.data.collection.map(this.getRequiredProps.bind(this));

		return requiredpropselements;
	}

	getRequiredProps(obj) {
		return {
			externalId: obj.externalId,
			class: this.nodesPath.dbids[obj.objectid].split('-')[1],
			dimensions: obj.properties.Dimensions,
			ifcmaterial: obj.properties['Materials and Finishes']
			// ifcmaterial: Object.values(obj.properties['Materials and Finishes'])
		}
	}

	getMap(node, stringPath) {
		// if (Object.keys(this.classesInMD).includes(node.name) || !node.objects) {
		// 	this.nodesPath.dbids[node.objectid] = stringPath + '-' + node.name;
		// 	return;
		// }

		if (!node.objects) {
			this.nodesPath.dbids[node.objectid] = stringPath + '-' + node.name;
			return;
		}

		node.objects.forEach(childNode => {
			this.getMap(childNode, stringPath + '-' + childNode.name);
		});
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
		// return responsejson.data.metadata.find(v => v.name === '{3D}').guid;
	}

	async getHyerarchyMap(urn, guid) {
		const res = await fetch(`https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/metadata/${guid}`, {
			method: "GET",
			headers: this._header(this.twoleggedtoken)
		})
		let jsonTree = await res.json();
		this.nodesPath = {
			'urn': urn,
			'dbids': {}
		};
		jsonTree.data.objects.forEach(nodeobj => {
			this.getMap(nodeobj, nodeobj.name);
		});
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

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

module.exports = Forge;
