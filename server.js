const express = require('express');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const cors = require('cors');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

app.post('/api/generate', (req, res) => {
  const form = formidable({ multiples: true, uploadDir: '/tmp', keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Form parse error' });

    try {
      const name = fields.name;
      const sport = fields.sport || 'unknown';
      const thumbnail = fields.thumbnail || 'unknown';

      const audioPath = files.audio?.filepath;
      const images = Array.isArray(files.images) ? files.images : [files.images];

      const tmpDir = fs.mkdtempSync(path.join('/tmp/', 'reel-'));
      const imageListPath = path.join(tmpDir, 'images.txt');
      const videoPath = path.join(tmpDir, 'output.mp4');

      const imagePaths = images.map((file, i) => {
        const newPath = path.join(tmpDir, `img${i}.jpg`);
        fs.copyFileSync(file.filepath, newPath);
        return newPath;
      });

      const imageTxt = imagePaths.map(p => `file '${p}'
duration 5`).join('\n') + `\nfile '${imagePaths[imagePaths.length - 1]}'`;
      fs.writeFileSync(imageListPath, imageTxt);

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(imageListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .input(audioPath)
          .outputOptions(['-vf', 'scale=720:1280,format=yuv420p', '-shortest', '-preset', 'fast', '-r', '30'])
          .audioCodec('aac')
          .videoCodec('libx264')
          .save(videoPath)
          .on('end', resolve)
          .on('error', reject);
      });

      const fileContent = fs.readFileSync(videoPath);
      const s3Key = `reels/${Date.now()}.mp4`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'video/mp4',
        Metadata: {
          celebrity: name,
          sport,
          generated_on: new Date().toISOString(),
          duration: '30',
          thumbnail,
        },
      });

      await s3.send(command);

      res.status(200).json({ message: 'Reel generated successfully', s3Key });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Generation failed', details: e.message });
    }
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
