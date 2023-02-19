const superagent = require(`superagent`);
const sharp = require('sharp');

module.exports = {
    types: [`image`],
    func: ({o, codecTypes, url}) => new Promise(async res => {
        superagent.get(url).then(r => {
            if(o.streams.find(o => o.width)) codecTypes.width = o.streams.find(o => o.width).width
            if(o.streams.find(o => o.height)) codecTypes.height = o.streams.find(o => o.height).height
            
            const maxRes = Number(require(`../config.json`).maxResolution) || 640

            if((codecTypes.width || maxRes+1) > maxRes || (codecTypes.height || maxRes+1) > maxRes) {
                try {
                    let args = {};

                    if(codecTypes.width > codecTypes.height) {
                        const reduction = Math.round(codecTypes.width/maxRes);

                        args = {
                            width: maxRes,
                            height: Math.round(codecTypes.height/reduction),
                            inside: true,
                        }
                    } else if(codecTypes.width < codecTypes.height) {
                        const reduction = Math.round(codecTypes.height/maxRes);

                        args = {
                            width: Math.round(codecTypes.width/reduction),
                            height: maxRes,
                            inside: true,
                        }
                    };

                    console.log(`W: ${args.width}; H: ${args.height}`)

                    sharp(r.body).resize(args).toBuffer().then(buf => res(require('stream').Readable.from(buf)))
                } catch(e) {
                    console.warn(`SHARP ERROR: ${e}`)
                    res(require('stream').Readable.from(r.body))
                }
            } else {
                console.log(`not big enough for reduction in size (${codecTypes.width}x${codecTypes.height})`);
                res(require('stream').Readable.from(r.body))
            }
        }).catch(e => {
            console.error(`SUPERAGENT ERROR: ${e}`)
            res({
                error: true,
                message: `An error occured while loading the image!`
            })
        })
    })
}