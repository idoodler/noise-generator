import express from 'express'
import { generateImage } from 'js-image-generator';
import fs from 'fs'

const port = process.env.PORT ?? 8080,
    app = express(),
    contentType = 'image/jpg'

let reqCnt = 0;

/**
 * Generates a random jpg image
 * @param height
 * @param width
 * @returns {Promise<Buffer>}
 */
const getImageData = async ({
    height = 120,
    width = 120,
                        }) => {
    return new Promise((resolve, reject) => {
        generateImage(Math.max(0, Math.min(width, 2048)), Math.max(Math.min(height, 2048)), 100, (e, img) => {
            if (e) {
                reject(e)
            } else {
                resolve(img.data)
            }
        })
    })
}

const sendMJPG = (req, res, next) => {
    return new Promise(async (resolve, reject) => {
        let imgGeneratorInterval;
        const stop = (error) => {
            imgGeneratorInterval && clearInterval(imgGeneratorInterval)
            if (error instanceof Error) {
                reject(error)
            } else {
                resolve()
            }
        }
        const {
            mjpgInterval = 100,
            mjpgOffset = false
        } = req.query
        const boundary = '--noiseGeneratorBoundary'

        res.writeHead(200, {
            'Cache-Control': 'no-store, no-cache, must-revalidate, pre-check=0, post-check=0, max-age=0',
            Pragma: 'no-cache',
            Connection: 'close',
            'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`
        })

        let sendBuffer;
        if (mjpgOffset) {
            try {
                const offsetImgData = await getImageData(req.query);
                // Fill the send buffer with half of a previous picture
                sendBuffer = offsetImgData.subarray(offsetImgData.length/2)
            } catch (e) {
                stop(e);
                return
            }
        } else {
            sendBuffer = new Buffer(0);
        }
        imgGeneratorInterval = setInterval(async () => {
            try {
                const imgData = await getImageData(req.query)
                sendBuffer = Buffer.concat([sendBuffer, imgData])
                let dataToSend = sendBuffer.subarray(0, imgData.length)
                next()
                res.write(`${boundary}\nContent-Type: ${contentType}\nContent-length: ${dataToSend.length}\n\n`)
                res.write(dataToSend)
                sendBuffer = sendBuffer.subarray(dataToSend.length)
            } catch (e) {
                stop(e)
            }
        }, Math.max(mjpgInterval, 100))
        res.socket.once('close', stop)
    });
}

app.get('/health', (req, res) => res.end('ok'));

app.get('/docs', async(req, res) => {
    res.end(await fs.promises.readFile('./Readme.md'))
})

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
            case 'mjpg':
                await sendMJPG(req, res, next)
                console.info(`Stopped request of type '${type}' with ID '${cntRef}'`)
                break;
            default:
                const imgData = await getImageData(req.query);
                res.set('Content-Type', contentType)
                res.send(imgData)
        }
    } catch (e) {
        next(e);
        console.warn(`Request of type '${type}' with ID '${cntRef}' failed`)
    }
})

app.listen(port, () => {
    console.log(`NoiseGenerator app is listening on port ${port}.`)
})
