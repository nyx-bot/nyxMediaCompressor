const cp = require('child_process');

const compressors = require('fs').readdirSync(`./compressors/`).filter(f => f.endsWith(`.js`)).map(f => Object.assign({
    name: f.split(`.`).slice(0, -1).join(`.`),
    filename: f,
}, require(`./compressors/${f}`)));

module.exports = (url) => new Promise(async res => {
    const ffprobeProc = cp.spawn(`ffprobe`, [`-i`, url, `-v`, `quiet`, `-print_format`, `json`, `-show_format`, `-show_streams`]);
    
    let ffprobeResult = ``;
    
    ffprobeProc.stdout.on(`data`, d => ffprobeResult += d.toString().trim());

    ffprobeProc.once(`close`, async (code) => {
        if(ffprobeResult.length > 0) try {
            const o = JSON.parse(ffprobeResult)
    
            //console.log(o)
    
            const codecTypes = {
                video: !o.format.format_name.endsWith(`_pipe`) && o.streams.find(o => o.codec_type == `video`) ? true : false,
                audio: o.streams.find(o => o.codec_type == `audio`) ? true : false,
                image: o.format.format_name.endsWith(`_pipe`) && o.streams.find(o => o.codec_type == `video`) ? true : false
            }
    
            console.log(`Data:\n- ${Object.entries(codecTypes).map(o => `${o[0]}: ${o[1]}`).join(`\n- `)}`);

            const types = Object.entries(codecTypes).filter(o => o[1] == true).map(o => o[0]);

            const usableCompressors = compressors.filter(c => {
                let usable = true;

                types.forEach(t => {
                    if(usable) {
                        if(c.types.indexOf(t) == -1) usable = false;
                    }
                });

                return usable;
            })

            //console.log(types, usableCompressors);

            console.log(`Types to use: ${types}`)

            let stream = null;

            for (const compressor of usableCompressors) {
                if(!stream) await new Promise(async c => {
                    const started = Date.now();

                    compressor.func({ 
                        o, 
                        codecTypes, 
                        url,
                    }).then(r => {
                        if(r && !r.error) {
                            stream = r;
                            console.log(`Completed using ${compressor.name} in ${(Date.now()-started)/1000} seconds!`)
                        }
                        c();
                    }).catch(e => {
                        console.error(e);
                        c();
                    })
                })
            };

            if(stream) {
                res(stream)
            } else {
                res({
                    error: true,
                    message: `All available compression methods failed.`
                })
            }
        } catch(e) {
            console.error(e);
            res({
                error: true,
                message: `Internal error occurred!`
            })
        } else res({
            error: true,
            message: `Cannot detect media type!`
        })
    })
})