import express from 'express'
import { generateImage } from 'js-image-generator';

const port = process.env.PORT ?? 8080,
    app = express()

let reqCnt = 0;

const getImageData = async ({
    height = 120,
    width = 120,
                        }) => {
    return new Promise((resolve, reject) => {
        generateImage(Math.max(0, Math.min(width, 2048)), Math.max(Math.min(height, 2048)), 10, (e, img) => {
            if (e) {
                reject(e)
            } else {
                resolve(img.data)
            }
        })
    })
}

const sendMJPG = (req, res, next) => {
    return new Promise((resolve, reject) => {
        let imgGeneratorInterval;
        const stop = () => {
            imgGeneratorInterval && clearInterval(imgGeneratorInterval)
            resolve()
        }
        const {
            mjpgInterval = 100,
        } = req.query
        const boundary = '--myBoundary'

        res.writeHead(200, {
            'Cache-Control': 'no-store, no-cache, must-revalidate, pre-check=0, post-check=0, max-age=0',
            Pragma: 'no-cache',
            Connection: 'close',
            'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`
        })

        imgGeneratorInterval = setInterval(async () => {
            try {
                const imgData = await getImageData(req.query)
                next()
                res.write(`${boundary}\nContent-Type: image/jpg\nContent-length: ${imgData.length}\n\n`)
                res.write(imgData);
            } catch (e) {
                reject(e)
            }
        }, Math.max(mjpgInterval, 100))
        res.socket.once('close', () => {
            stop()
        })
    });
}

app.get(/\/?/, async (req, res, next) => {
    const cntRef = reqCnt++
    const {
        type = 'jpg',
        cors = false
    } = req.query
    cors && res.set('Access-Control-Allow-Origin', '*')
    console.info(`Starting request of type '${type}' with ID '${cntRef}'`)

    try {
        switch (type) {
            case 'jpg':
                const imgData = await getImageData(req.query);
                res.set('Content-Type', 'image/jpg')
                res.send(imgData)
                break
            case 'mjpg':
                await sendMJPG(req, res, next)
                console.info(`Stopped request of type '${type}' with ID '${cntRef}'`)
                break;
        }
    } catch (e) {
        next(e);
        console.warn(`Request of type '${type}' with ID '${cntRef}' failed`)
    }
})

app.get('/health', (req, res, next) => res.end('ok'));

app.listen(port, () => {
    console.log(`NoiseGenerator app is listening on port ${port}.`)
})
