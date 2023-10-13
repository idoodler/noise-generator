# noise-generator

Generates a random image with a specified `height` and `width`.

## Query Parameters
| Param        | Accepted         | Default  |
|--------------|------------------|----------|
| height       | Number(0...2048) | 120      |
| width        | Number(0...2048) | 120      |
| cors         | true\|false      | false    |
| type         | jpg\|mjpg        | jpg      |
| mjpgInterval | Number(100...)   | 100 (ms) |
| mjpgOffset   | true\|false      | false    |

## Docker
`docker pull ghcr.io/idoodler/noise-generator:latest`
