import express from 'express'
import { generateImage } from 'js-image-generator';

const port = process.env.PORT ?? 8080,
    app = express()

app.get(/\/?/, (req, res, next) => {
    const {
        height = 120,
        width = 120,
        cors = false
    } = req.query

    generateImage(Math.max(0, Math.min(width, 2048)), Math.max(Math.min(height, 2048)), 80, (e, img) => {
        if (e) {
            next(e);
        } else {
            res.set('Content-Type', 'image/png')
            cors && res.set('Access-Control-Allow-Origin', '*')
            res.send(img.data)
        }
    })
})

app.get('/health', (req, res, next) => res.end("ok"));

app.listen(port, () => {
    console.log(`NoiseGenerator app is listening on port ${port}.`)
})
