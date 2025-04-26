const express = require('express');
const { IncomingForm } = require('formidable');
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());

app.post('/ffmpeg/generate-video', (req, res) => {
  const form = new IncomingForm({
    multiples: true,
    uploadDir: '/tmp',
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[FORM_PARSE_ERROR]', err);
      return res.status(500).json({ error: 'Form parse error' });
    }

    console.log('\n========= [FFMPEG BACKEND INVOKED] =========');
    console.log('[FIELDS]', fields);
    console.log('[FILES]', files);

    try {
      const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
      if (!audioFile || !audioFile.filepath) {
        console.error('[ERROR] Missing audio file in request');
        return res.status(400).json({ error: 'Audio file missing' });
      }

      const audioPath = audioFile.filepath;
      console.log('[AUDIO PATH]', audioPath);

      const images = Array.isArray(files.images) ? files.images : [files.images];
      if (!images || !images.length) {
        console.error('[ERROR] No images provided');
        return res.status(400).json({ error: 'Image files missing' });
      }

      const tmpDir = fs.mkdtempSync(path.join('/tmp/', 'reel-'));
      const imageListPath = path.join(tmpDir, 'images.txt');
      const videoPath = path.join(tmpDir, 'output.mp4');

      const imagePaths = images.map((file, i) => {
        const newPath = path.join(tmpDir, `img${i}.jpg`);
        fs.copyFileSync(file.filepath, newPath);
        return newPath;
      });

      const imageTxt = imagePaths
        .map(p => `file '${p}'\nduration 5`)
        .join('\n') + `\nfile '${imagePaths[imagePaths.length - 1]}'`;

      fs.writeFileSync(imageListPath, imageTxt);
      console.log('[TEMP DIR]', tmpDir);
      console.log('[IMAGE LIST]', imageListPath);
      console.log('[VIDEO OUT PATH]', videoPath);

      // Run ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(imageListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .input(audioPath)
          .outputOptions([
            '-vf', 'scale=720:1280,format=yuv420p',
            '-shortest',
            '-preset', 'fast',
            '-r', '30'
          ])
          .audioCodec('aac')
          .videoCodec('libx264')
          .save(videoPath)
          .on('start', command => console.log('[FFMPEG STARTED]', command))
          .on('end', () => {
            console.log('[FFMPEG DONE]');
            resolve();
          })
          .on('error', (err) => {
            console.error('[FFMPEG ERROR]', err);
            reject(err);
          });
      });

      console.log('[VIDEO GENERATED SUCCESSFULLY]', videoPath);

      res.status(200).json({
        message: 'Video generated successfully',
        videoPath,
      });
    } catch (e) {
      console.error('[FFMPEG_GENERATION_ERROR]', e);
      res.status(500).json({ error: 'FFmpeg generation failed', details: e.message });
    }
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ FFmpeg server running on port ${PORT}`));
