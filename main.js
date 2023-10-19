import express from 'express'
import { generateImage } from 'js-image-generator'
import fs from 'fs'
import Jimp from 'jimp'
import boolParser from 'express-query-boolean'

const port = process.env.PORT ?? 8080,
    app = express(),
    contentType = 'image/jpeg',
    boundary = '--noiseGeneratorBoundary',
    infoBlack = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK),
    infoWhite = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE),
    timeBlack = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK),
    timeWhite = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE)


let reqCnt = 0

const getConfigValue = value => {
    switch (typeof value) {
        case 'boolean':
            return value ? 'Y' : 'N'
        default:
            return value
    }
}

/**
 * Generates a random jpg image
 * @param config Contains width and heights of the image, min = 120, max = 2048
 * @returns {Promise<Buffer>}
 */
const getImageData = async (config) => {
    const width = Math.max(120, Math.min(config.width ?? 120, 2048)),
        height = Math.max(120, Math.min(config.height ?? 120, 2048))
    return new Promise((resolve, reject) => {
        generateImage(width, height,100, async (e, img) => {
            if (e) {
                reject(e)
            } else {
                const jimpImg = await Jimp.read(img.data)
                const currentTime = new Date().toLocaleTimeString()
                Object.keys(config).forEach((key, idx) => {
                    const y = idx * 16
                    jimpImg.print(infoBlack, 0, y -1, `${key}: ${getConfigValue(config[key])}`)
                    jimpImg.print(infoWhite, 1, y, `${key}: ${getConfigValue(config[key])}`)
                })
                // Rendering two, offset fonts results in a nice readable text
                jimpImg.print(timeBlack, 0, ((width - 32)/2) -1, currentTime)
                jimpImg.print(timeWhite, 1, (width - 32)/2, currentTime)
                resolve(await jimpImg.getBufferAsync(contentType))
            }
        })
    })
}

const sendMJPG = (req, res, next) => {
    return new Promise(async (resolve, reject) => {
        let imgGeneratorInterval
        const stop = (error) => {
            imgGeneratorInterval && clearInterval(imgGeneratorInterval)
            if (error instanceof Error) {
                reject(error)
            } else {
                resolve()
            }
        }
        let {
            mjpgInterval = 100,
            mjpgMod = '',
            mjpgHeaderMod = ''
        } = req.query

        mjpgMod = mjpgMod.split(',');
        mjpgHeaderMod = mjpgHeaderMod.split(',')

        res.writeHead(200, {
            'Cache-Control': 'no-store, no-cache, must-revalidate, pre-check=0, post-check=0, max-age=0',
            Pragma: 'no-cache',
            Connection: 'close',
            'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`
        })

        let sendBuffer
        if (mjpgMod.includes('offset')) {
            try {
                const offsetImgData = await getImageData(req.query)
                // Fill the send buffer with half of a previous picture
                sendBuffer = offsetImgData.subarray(offsetImgData.length/2)
            } catch (e) {
                stop(e)
                return
            }
        } else {
            sendBuffer = new Buffer(0)
        }
        imgGeneratorInterval = setInterval(async () => {
            try {
                const imgData = await getImageData(req.query)
                sendBuffer = Buffer.concat([sendBuffer, imgData])
                let dataToSend = sendBuffer.subarray(0, imgData.length)
                if (mjpgMod.includes('padd')) {
                    dataToSend = Buffer.concat([dataToSend, Buffer.alloc(512)])
                }
                next()
                const payloadHeader = [
                    boundary,
                    `Content-Type: ${contentType}`
                ]
                if (mjpgHeaderMod.includes('noLength')) {
                    payloadHeader.push(`Content-length: ${dataToSend.length}`)
                } else if (mjpgHeaderMod.includes('zeroLength')) {
                    payloadHeader.push(`Content-length: 0`)
                }
                res.write(`${payloadHeader.join('\n')}\n\n`)
                res.write(dataToSend)
                sendBuffer = sendBuffer.subarray(dataToSend.length)
            } catch (e) {
                stop(e)
            }
        }, Math.max(mjpgInterval, 100))
        res.socket.once('close', stop)
    })
}

app.use(boolParser());

app.get('/health', (req, res) => res.end('ok'))

app.get('/docs', async(req, res) => {
    res.end(await fs.promises.readFile('./Readme.md'))
})

app.get(/\/?/, async (req, res, next) => {
    const cntRef = reqCnt++
    req.query.cnt = cntRef
    const {
        type = 'jpg',
        cors = false
    } = req.query
    cors && res.set('Access-Control-Allow-Origin', '*')
    console.info(`Starting request of type '${type}' with ID '${cntRef}'`)

    try {
        switch (type) {
            case 'mjpg':
            case '.mjpg':
                await sendMJPG(req, res, next)
                console.info(`Stopped request of type '${type}' with ID '${cntRef}'`)
                break
            default:
                const imgData = await getImageData(req.query)
                res.set('Content-Type', contentType)
                res.send(imgData)
        }
    } catch (e) {
        next(e)
        console.warn(`Request of type '${type}' with ID '${cntRef}' failed`)
    }
})

app.listen(port, () => {
    console.log(`NoiseGenerator app is listening on port ${port}.`)
})
