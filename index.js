const express = require('express')();

const compress = require(`./compress`)

express.get(`/compress/:url(*+)`, (req, res) => {
    if(req.params.url && req.params.url.length > 0) {
        compress(req.params.url).then(r => {
            if(r && r.error) {
                res.send(r)
            } else if(r.pipe) {
                r.pipe(res)
            } else {
                res.send({
                    error: true,
                    message: `There was nothing returned to the request. This is an internal error.`
                })
            }
        })
    } else res.send({
        error: true,
        message: `No URL was provided!`
    })
});

const port = Number(require(`./config.json`).port) || 4000

express.listen(port, () => {
    console.log(`Server is online, listening at port ${port}`)
})