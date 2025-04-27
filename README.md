# Essentially Sports Reels – FFmpeg Backend

This repository is the microservice backend responsible for video generation using FFmpeg. It accepts audio and image data via `multipart/form-data`, processes them into vertical video reels (`.mp4`), and uploads them to Amazon S3 with relevant metadata.

---

## Features

- Accepts multi-part uploads: audio (.mp3) and images (.jpg/.png)
- Generates a vertical short-form video using FFmpeg
- Optimized output: 720x1280 resolution, 30 FPS, H.264, AAC
- Auto-upload to AWS S3 with metadata: celebrity, sport, thumbnail, duration
- Logs detailed FFmpeg CLI usage and error diagnostics
- Deployed on Render with persistent `/tmp` file usage

---

##
Endpoint

### `POST /ffmpeg/generate-video`

**Description:** Accepts audio + images and returns a signed S3 URL after generating and uploading the video.

#### Payload (multipart/form-data)

| Field      | Type       | Required | Description                             |
|------------|------------|----------|-----------------------------------------|
| `name`     | `string`   | Yes      | Celebrity name                          |
| `sport`    | `string`   | Yes      | Sport category                          |
| `thumbnail`| `string`   | Yes      | Player thumbnail URL                    |
| `audio`    | `file (.mp3)` | Yes   | Audio narration of the script           |
| `images`   | `file[]`   | Yes      | Array of 5 vertical images (.jpg/.png)  |

#### Response

```json
{
  "message": "Uploaded",
  "s3Key": "reels/1682736192.mp4"
}
```

#### Video Generation Logic
Input images are converted into a temporary images.txt file with FFmpeg duration entries.

FFmpeg concatenates all images using:

ffmpeg -f concat -safe 0 -i images.txt -i audio.mp3 \
  -vf scale=720:1280,format=yuv420p -shortest -preset fast -r 30 output.mp4
Output is stored in /tmp/output.mp4 before uploading.

#### AWS S3 Upload
Uploaded with metadata:

celebrity: name

sport: category

thumbnail: image URL

generated_on: ISO timestamp

duration: fixed at 30 seconds

Configure via .env:

AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=your-bucket

#### Setup
Install dependencies
npm install
Start server
node server.js
Default port is 4000. You can override with:
PORT=5000 node server.js
