const BASEAPI = ``;

export class DA4Revit {
  constructor(RevitFileURN, args, token) {
    this.token = token; // Forge 2legged token needed by DA4Revit services
    this.uploadRevitPlugin();
    this.dasApiRoot = BASEAPI;
    this.src = RevitFileURN;
    this.dst = "";
  }

  extract() {
    await this.sendWorkItem(PLUGIN_ID, RevitFileURN, options);
  }

  async post(url, body) {
    const res = await fetch("POST", `${this.dasApiRoot}${url}`,this.token, body);
    const json = await res.json();
    return json;
  }

  get() {
    const res = await fetch("GET", `${this.dasApiRoot}${url}`,this.token, body);
    const json = await res.json();
    return json;
  }

  initPlugin() {
    console.log("create app bundle, upload it, create activity & activity alias")
    console.log("use POSTMAN collection and follow up to step5: https://www.youtube.com/watch?v=YxCrv3Fh-5c")
    this.activityId = "PLUGIN_ID";
  }

  createActivity() {
    const body = {
    }
    const res = await this.post("/activities", body);
    return res;
  }
 
  sendWorkItem() {
    const body = {
      activityId: this.activityId,
      arguments: {
        inputRevitURN: this.src,
        outputJSON: this.dst,
      }
    };
    await this.post(`/workitems`, body);
  }

  statusWorkItem() {
  }

}

export class Forge {
  constructor(client, secret) {
    this.client = client;
    this.secret = secret;
    this.dasApiRoot = BASEAPI;
  }

  getToken() {
    await fetch()
  }
}

export class Bim360 {
    constructor(project, folder, token) {
        this.folder = folder;
        this.project = project;
        this.token = token;
    }

    async getFolderContents() {
        const res = await fetch( `https://developer.api.autodesk.com/data/v1/projects/${this.project}/folders/urn:adsk.wipprod:fs.folder:${this.folder}/contents`, 
        { headers: { Authorization: `Bearer ${this.token}` }});
        const jres = await res.json();
        if (!jres.included) return jres;
        let lista = jres.included.map(i => { return ({ 
            filename: i.attributes.displayName, 
            size:i.attributes.storageSize,
            lastModifiedTime: i.attributes.lastModifiedTime,
            lineage: i.relationships.item.data.id,
            version: i.attributes.versionNumber,
            datetime: (new Date(i.attributes.lastModifiedTime)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
            url: `https://developer.api.autodesk.com/oss/v2/buckets/wip.dm.prod/objects/${i.relationships.storage.data.id.split('/')[1]}`
        })});
        lista.sort((a,b)=>{return (b.lastModifiedTime < a.lastModifiedTime) ? -1:1});
        return lista;
    }

    

    // token2 (optional) is a second ACCESS_TOKEN of a 2nd BIM360 HUB.
    // Use this to save the resulting output file to a secondary BIM360 Hub
    async createEmptyFile(filename) {
        //const id = `${Math.random()}`.slice(2,5);
        this.filename = filename;//`_${filename.slice(0,-4)}_${id}${filename.slice(-4)}`;
        const res = await fetch( `https://developer.api.autodesk.com/data/v1/projects/${this.project}/storage`, 
        {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/vnd.api+json',
                Accept : 'application/vnd.api+json',
                Authorization: `Bearer ${this.token}`
            },
            body: `{
                "jsonapi": { "version": "1.0" },
                "data": {
                  "type": "objects",
                  "attributes": {
                    "name": "${this.filename}"
                  },
                  "relationships": {
                    "target": {
                      "data": { "type": "folders", "id": "urn:adsk.wipprod:fs.folder:${this.folder}" }
                    }
                  }
                }
          }`
        });
        const obj = await res.json();
        this.objid = obj.data.id.split("/")[1];
        return {
          objid: this.objid,
          filename: this.filename,
          destURL: `https://developer.api.autodesk.com/oss/v2/buckets/wip.dm.prod/objects/${this.objid}`
        }
    }

    async createVersion( ob ) {
        const res = await fetch( `https://developer.api.autodesk.com/data/v1/projects/${this.project}/items`, 
        {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/vnd.api+json',
                Accept : 'application/vnd.api+json',
                Authorization: `Bearer ${this.token}`
            },
            body: `{
                "jsonapi": { "version": "1.0" },
                "data": {
                  "type": "items",
                  "attributes": {
                    "displayName": "${ob.filename}",
                    "extension": {
                      "type": "items:autodesk.bim360:File",
                      "version": "1.0"
                    }
                  },
                  "relationships": {
                    "tip": {
                      "data": {
                        "type": "versions", "id": "1"
                      }
                    },
                    "parent": {
                      "data": {
                        "type": "folders",
                        "id": "urn:adsk.wipprod:fs.folder:${this.folder}"
                      }
                    }
                  }
                },
                "included": [
                  {
                    "type": "versions",
                    "id": "1",
                    "attributes": {
                      "name": "${ob.filename}",
                      "extension": {
                        "type": "versions:autodesk.bim360:File",
                        "version": "1.0"
                      }
                    },
                    "relationships": {
                      "storage": {
                        "data": {
                          "type": "objects",
                          "id": "urn:adsk.objects:os.object:wip.dm.prod/${ob.objid}"
                        }
                      }
                    }
                  }
                ]
              }`
        });
        const obj = await res.json();
        return obj;
    }

    async getTip( ob, lineageId ) {
      
    }

    async bumpVersion( ob, lineageId ) {
      const res = await fetch( `https://developer.api.autodesk.com/data/v1/projects/${this.project}/versions`, 
      {
          method: 'POST', 
          headers: {
              'Content-Type': 'application/vnd.api+json',
              Accept : 'application/vnd.api+json',
              Authorization: `Bearer ${this.token}`
          },
          body: `{
            "jsonapi": { "version": "1.0" },
            "data": {
               "type": "versions",
               "attributes": {
                  "name": "${ob.filename}",
                  "extension": { "type": "versions:autodesk.bim360:File", "version": "1.0"}
               },
               "relationships": {
                  "item": { "data": { "type": "items", "id": "${lineageId}" } },
                  "storage": { "data": { "type": "objects", "id": "urn:adsk.objects:os.object:wip.dm.prod/${ob.objid}" } }
               }
            }
         }`
      });
      const obj = await res.json();
      return obj;
  }
}