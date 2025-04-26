const express = require('express');
const { IncomingForm } = require('formidable');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { generateVideo } = require('./generateVideo');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const app = express();
app.use(cors());

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

app.post('/ffmpeg/generate-video', (req, res) => {
  const form = new IncomingForm({ multiples: true, uploadDir: '/tmp', keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Form parse error' });

    try {
      const name = fields.name || 'unknown';
      const sport = fields.sport || 'unknown';
      const thumbnail = fields.thumbnail || 'unknown';
      const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;

      if (!audioFile || !audioFile.filepath) {
        return res.status(400).json({ error: 'Audio file missing' });
      }

      const audioPath = audioFile.filepath;

      const imageFiles = Array.isArray(files.images) ? files.images : [files.images];
      const imageUrls = imageFiles.map(file => `file://${file.filepath}`);

      console.log('[GENERATION START]', { name, sport, thumbnail, audioPath, imageUrls });

      const finalVideoPath = await generateVideo({
        imageUrls: imageFiles.map(img => img.filepath),
        audioPath
      });

      const fileContent = fs.readFileSync(finalVideoPath);
      const s3Key = `reels/${Date.now()}.mp4`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'video/mp4',
        Metadata: {
          celebrity: name,
          sport,
          thumbnail,
          generated_on: new Date().toISOString(),
          duration: '30',
        },
      });

      await s3.send(command);
      console.log('[S3 UPLOAD DONE]', s3Key);

      res.status(200).json({ message: 'Uploaded', s3Key });
    } catch (e) {
      console.error('[GENERATION_ERROR]', e);
      res.status(500).json({ error: 'Video generation failed', details: e.message });
    }
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`FFmpeg server running on port ${PORT}`));
