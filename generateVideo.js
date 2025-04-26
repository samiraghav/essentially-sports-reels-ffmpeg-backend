const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

ffmpeg.setFfmpegPath(ffmpegPath);

exports.generateVideo = async function ({ imageUrls, audioPath }) {
  const tmpDir = path.join('/tmp', uuidv4());
  fs.mkdirSync(tmpDir);

  const imagePaths = imageUrls.map((src, i) => {
    const newPath = path.join(tmpDir, `img${i}.jpg`);
    fs.copyFileSync(src, newPath);
    return newPath;
  });

  const imageListPath = path.join(tmpDir, 'images.txt');
  const videoPath = path.join(tmpDir, 'output.mp4');

  const content = imagePaths
    .map((p) => `file '${p}'\nduration 5`)
    .join('\n') + `\nfile '${imagePaths[imagePaths.length - 1]}'`;

  fs.writeFileSync(imageListPath, content);

  return new Promise((resolve, reject) => {
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
      .on('start', command => console.log('[FFMPEG CMD]', command))
      .on('end', () => {
        console.log('[FFMPEG DONE]');
        resolve(videoPath);
      })
      .on('error', (err) => {
        console.error('[FFMPEG ERROR]', err);
        reject(err);
      });
  });
};
