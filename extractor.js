//
// Main
//
export class netZipExtract {
    constructor(URN, fileLength, token) {
        this.URL = `${URN}`;
        this.token = token;
        this.fileLength = fileLength;
    }

    //
    // fetch a chunk of bytes from BIM360 and write to 'temp' file on fs
    //
    async _fetchWrite( fd, offset, length ) { 
        const res = await fetch( this.URL, { headers: {
            'range': `bytes=${offset}-${offset+length}`,
            'Authorization': `Bearer ${this.token}`
        }});
        if (res.status != 206) 
            throw(`error:${res.statusText}, bytes=${offset}-${offset+length}`)
        const buff = await res.buffer();
        fs.writeSync(fd, buff, 0, buff.length, offset);
        return res.status;
    }

    async _createTempZip(offset, size) {
        const tmpfile = fs.openSync(this.tmpFn, 'w');
        const chunksize = 4 * 1024; // only need 16k bytes of data
        await this._fetchWrite(tmpfile, 0, chunksize); // fetch/write header            
        await this._fetchWrite(tmpfile, this.fileLength - chunksize, chunksize); // fetch/write footer
        const zipHeaderOffset = 128;
        if (size)
            await this._fetchWrite(tmpfile, offset, size + zipHeaderOffset); // fetch/write our filename within the zip
        fs.closeSync(tmpfile);        
    }

    //
    // get directory-list inside zip (that's hosted on bim360)
    //
    async getContents() { return new Promise(async resolve => {
        this._log(`fetch/extract Contents: ${this.URL} size ${this.fileLength}...`)
        try {
            await this._createTempZip();
            // now, extract content directory
            this.zip = new StreamZip({ file: this.tmpFn, storeEntries: true });
        }
        catch(err) {resolve(err);return}
        this.zip.on('error', (err) => { resolve(`error:${err}`) });
        this.zip.on('ready', () => { 
            this.entries = this.zip.entries();
            this.zip.close();
            resolve(this.entries);
        });
    })};

    //
    // extract a file from inside the zip file, then post it to bim360 destURL
    //
    async extractFile( filename, destURL ) { return new Promise(async resolve => {
        // get filename's offset and byte-length, located inside the zip file
        if (!this.entries) return;
        const offset = this.entries[filename].offset;
        const size = this.entries[filename].compressedSize;
        this.filename = filename;

        // now, fetch the exact bytes from bim360, and write to our temp file
        const MBytes = Math.round(size / 100000) / 10;
        this._log(`(downloading ${MBytes} MB) ${filename} , zip offset: ${offset}`)
        await this._createTempZip(offset, size);

        // now, use StreamZip to do it's magic.
        this._log(`Extracting ${filename} from ${this.tmpFn}...`)
        this.zip = new StreamZip({ file: this.tmpFn, storeEntries: true });
        this.zip.on('error', err => { throw(`error:${err}`) });
        this.zip.on('ready', async () => { 
            this.entries = this.zip.entries();

            this.zip.extract( filename, filename, async err => {
            //if (err) throw(`Zip-Extract error: ${err}`);

            this._log(`Uploading (0 KB) ${filename} to ${destURL}...`)

            // upload file to forge signedURL
            let bytes = size;
            const stream = fs.createReadStream(filename,{highWaterMark: 1024 * 1024 });
            stream.on('data', b => { 
                this._log(`Upload progress ${96-Math.round((bytes/size)*96)}%`)
                bytes-=b.length;
            });
            const rs2 = await fetch(destURL, { 
                method: 'PUT',
                headers: { Authorization: `Bearer ${this.token}` },
                body: stream });
            const res2 = await rs2.json();
            console.log(res2);
            // this.zip.close();  // don't close zip before upload complete. this seems buggy for slow networks
            this._log(`Upload complete: ${filename} to ${destURL}.${JSON.stringify(res2)}`)
            resolve(`Upload complete: ${filename} to ${destURL}. ${res2}`)
            });
        });
    })}

    _log(m) {
        console.log(m);
        if (this.filename) this.session[this.filename] = m;
    }
}

