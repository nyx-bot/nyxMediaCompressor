const cp = require('child_process')

const hwAccelEnabled = require(`../config.json`).hwAccel && require(`fs`).existsSync(`/dev/dri/renderD128`) 

module.exports = {
    types: [`video`, `audio`],
    func: ({o, codecTypes, url}) => new Promise(async res => {
        console.log(`FFmpeg was called! hwAccel: ${hwAccelEnabled}`)

        if(codecTypes.video) {
            codecTypes.width = o.streams.find(o => o.codec_type == `video`).width;
            codecTypes.height = o.streams.find(o => o.codec_type == `video`).height;

            if(o.streams.find(o => o.codec_type == `video`).bit_rate) codecTypes.vbr = Number(o.streams.find(o => o.codec_type == `video`).bit_rate)/1000
            if(o.streams.find(o => o.codec_type == `video`).codec_name) codecTypes.vcodec = o.streams.find(o => o.codec_type == `video`).codec_name
        };

        if(codecTypes.audio) {
            if(o.streams.find(o => o.codec_type == `audio`).sample_rate) codecTypes.asr = Number(o.streams.find(o => o.codec_type == `audio`).sample_rate)
            if(o.streams.find(o => o.codec_type == `audio`).bit_rate) codecTypes.abr = Number(o.streams.find(o => o.codec_type == `audio`).bit_rate)
            if(o.streams.find(o => o.codec_type == `audio`).codec_name) codecTypes.acodec = o.streams.find(o => o.codec_type == `audio`).codec_name
        }

        console.log(`Data:\n- ${Object.entries(codecTypes).map(o => `${o[0]}: ${o[1]}`).join(`\n- `)}`);

        let ffmpegArgs = [];

        if(codecTypes.video && (codecTypes.vbr || 3001) > 3000) {
            ffmpegArgs.push(`-vcodec`, ...(hwAccelEnabled ? [`h264_vaapi`, `-profile`, `100`/*, `-bf`, `0`*/] : [`h264`, `-profile:v`, `high`]), `-r`, `30`, /*`-crf`, `0`*/);

            let filter = [];

            const maxRes = Number(require(`../config.json`).maxResolution) || 640

            if(codecTypes.width && codecTypes.height && (codecTypes.width > maxRes || codecTypes.height > maxRes)) {
                if(codecTypes.width > codecTypes.height) {
                    const reduction = Math.round(codecTypes.width/maxRes);

                    if(hwAccelEnabled) {
                        filter.push(`scale_vaapi=w=${maxRes}:h=${Math.round(codecTypes.height/reduction)}`)
                    } else {
                        filter.push(`scale=${maxRes}:${Math.round(codecTypes.height/reduction)}`)
                    }
                } else if(codecTypes.width < codecTypes.height) {
                    const reduction = Math.round(codecTypes.height/maxRes);
                    
                    if(hwAccelEnabled) {
                        filter.push(`scale_vaapi=w=${Math.round(codecTypes.width/reduction)}:h=${maxRes}`)
                    } else {
                        filter.push(`scale=${Math.round(codecTypes.width/reduction)}:${maxRes}`)
                    }
                };
            }

            if(codecTypes.vbr > 3000) {
                console.log(`VBR greater than 3mbps (${codecTypes.vbr}) -- lowering!`)
                ffmpegArgs.push(`-b:v`, `2500k`)
            } else {
                console.log(`VBR less than 3mbps (${codecTypes.vbr}) -- setting accordingly!`)
                ffmpegArgs.push(`-b:v`, `${codecTypes.vbr}k`)
            }

            if(hwAccelEnabled) {
                console.log(`Hardware acceleration is enabled, setting filter HW device to VAAPI`)
                ffmpegArgs.push(`-filter_hw_device`, `foo`);
                filter.unshift(`hwupload`)
            }

            if(filter && filter.length > 0) ffmpegArgs.push(`-vf`, filter.join(`,`))
        } else ffmpegArgs.push(`-vcodec`, `copy`);
        
        if(codecTypes.audio && (codecTypes.asr > 44100 || codecTypes.abr > 64000)) {
            ffmpegArgs.push(`-acodec`, `mp3`);

            ffmpegArgs.push(`-ar`, `44100`)
            ffmpegArgs.push(`-b:a`, `64000`)
        } else ffmpegArgs.push(`-acodec`, `copy`);

        if(ffmpegArgs.length > 0) {
            let outputFormat = o.format.format_name.split(`,`).find(s => s == url.split(`.`).slice(-1)[0]);
            if(!outputFormat) outputFormat = o.format.format_name.split(`,`)[0];

            outputFormat = `ismv`

            const useArgs = [`-i`, url, ...ffmpegArgs, `-f`, outputFormat, `-`, /*`-loglevel`, `error`,*/ `-hide_banner`];

            if(hwAccelEnabled) {
                useArgs.unshift(`-init_hw_device`, `vaapi=foo:/dev/dri/renderD128`, `-hwaccel`, `vaapi`, `-hwaccel_device`, `foo`);
                useArgs.splice(useArgs.indexOf(`-`)+1, 0, `-hwaccel_output_format`, `vaapi`)
            }

            console.log(`Spawning FFmpeg with args:\n- ${useArgs.map(s => s.includes(` `) ? `"${s}"` : s).join(` `)}`)

            const startTime = Date.now()

            const ffmpeg = cp.spawn(`ffmpeg`, useArgs);

            res(ffmpeg.stdout);

            ffmpeg.stderr.on(`data`, d => console.log(`FFMPEG: ${d.toString().trim().split(`\n`).join(`\nFFMPEG: `)}`))

            ffmpeg.on(`close`, (code) => console.log(`FFmpeg has completed with code ${code} in ${(Date.now()-startTime)/1000} seconds`))
            ffmpeg.on(`error`, (e) => console.log(`FFmpeg has exited with error:`, e))
        } else return res({
            error: true,
            message: `Uncompressable media!`
        })
    })
}