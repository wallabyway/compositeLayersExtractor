

var ServerURL = '';
//var ServerURL = 'https://bim360-zip-extract.herokuapp.com';

// Vue.js components
window.app = new Vue({
    el: "#app",

    data: {
        clientID: "rZboPCXwdKnmxeByCWbX7Fz1YGmIjGja",
        scope: "data:read",
        redirect_uri: encodeURIComponent(location.href.split('#')[0]),
        token: null,
        form: {
            srcURN: "",
        },
        istoast: false,
        toastmsg: "na",
        treeData: { filename: "BIM360", datetime: "-", isOpen: true },
    },
    methods: {

        onClickItem: function (item) {
            window.sessionStorage.selectedItem = item.url;
            this.switchView(item.urn, item.guid);
            this.triggerJob(item);
        },

        loginlogout: function () {
            if (!this.token)
                location.href = `https://developer.api.autodesk.com/authentication/v1/authorize?response_type=token&client_id=${this.clientID}&redirect_uri=${this.redirect_uri}&scope=${encodeURIComponent(this.scope)}`;
            else {
                delete (window.sessionStorage.token);
                location.hash = "";
                location.reload();
            }
        },


        init() {
            //update URN parameters
            if (location.hash.length > 2) {
                let params = location.hash.slice(1).split('&').map(i => { return i.split('=') });
                if (params && (params[0][0] == "access_token"))
                    window.sessionStorage.token = params[0][1];
                else {
                    params = location.hash.slice(1).split('/')
                    window.sessionStorage.project = params[4];
                    window.sessionStorage.folder = params[6];
                }
            }
            this.token = window.sessionStorage.token;
            this.form.srcURN = window.sessionStorage.project;
            this.listBimFiles();
            this.startViewer(document.getElementById('forgeviewer'));
            this.showtoast('starting...')
        },

        triggerJob: async function (item) {
            this.showtoast("Processing");
            const url = `${ServerURL}/job/trigger?urn=${item.urn}&viewable=${item.filename}&fileurl=${item.url}&token=${this.token}`;
            const res = await (await fetch(url, { mode: 'cors' })).json();
            this.showtoast(res);
            console.log(res);
        },

        listBimFiles: async function () {
            const url = `${ServerURL}/bim/list?project=${window.sessionStorage.project}&folder=${window.sessionStorage.folder}&token=${window.sessionStorage.token}`;
            const res = await (await fetch(url, { mode: 'cors' })).json();
            await this.renderTreeView(this.treeData, res);
            for (const model of this.treeData.children) {
                const viewables = await this.listModelViewables(model.urn, model.url);
                if (viewables)
                    await this.renderTreeView(model, viewables);
            }
        },

        listModelViewables: async function (modelurn, modelurl) {
            const url = `${ServerURL}/views/list?urn=${modelurn}&url=${modelurl}`;
            const res = await (await fetch(url, { mode: 'cors' })).json();
            return res;
            // await this.renderTreeView(this.treeData, res);
        },

        renderTreeView: async function (treeDiv, data) {
            Vue.set(treeDiv, "children", data);
            treeDiv.isOpen = true;
        },

        showtoast: function (msg) {
            console.log(msg);
            this.istoast = true;
            this.toastmsg = msg;
            setTimeout(function () { app.istoast = false; }, 5000);
        },


        switchView(urn, guid) {
            async function enableGeomtricBoxSelection() {
                viewer.unloadExtension('Autodesk.BoxSelection');
                ext = await viewer.loadExtension('Autodesk.BoxSelection', { useGeometricIntersection: true });
                // invoke box selection by holding cmd(mac) / ctrl(windows) + mouse drag
                ext.addToolbarButton(true);
            }

            Autodesk.Viewing.Document.load(`urn:${urn}`, (doc) => {
                var viewables = doc.getRoot().getDefaultGeometry();
                // var viewables = doc.getRoot().findByGuid(guid);
                viewer.loadDocumentNode(doc, viewables).then(() => { enableGeomtricBoxSelection(); console.log(`loaded ${urn}`) });
            });
        },

        startViewer(div) {
            const options = {
                env: 'AutodeskProduction',
                accessToken: this.token,
                isAEC: true
            };

            Autodesk.Viewing.Initializer(options, () => {
                viewer = new Autodesk.Viewing.Private.GuiViewer3D(div,
                    { extensions: ['HistogramExtension', 'Autodesk.BoxSelection'] });
                viewer.start();
                viewer.setTheme("light-theme");
                this.viewer = viewer;
            });
        }
    }
})

window.app.init();


// define the tree-item component
Vue.component("tree-item", {
    template: "#item-template",
    props: {
        item: Object
    },
    data: function () {
        return {
            isOpen: true
        };
    },
    computed: {
        isFolder: function () {
            return this.item.children && this.item.children.length;
        }
    },
    methods: {
        toggle: function () {
            if (this.isFolder)
                this.isOpen = !this.isOpen;
            else
                this.$emit("on-select", this.item);
        }
    }
});

