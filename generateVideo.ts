import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(path.resolve(ffmpegPath!));

export async function generateVideo({
  imageUrls,
  audioPath,
  scriptText
}: {
  imageUrls: string[];
  audioPath: string;
  scriptText: string;
}): Promise<string> {
  const tmpDir = path.join('/tmp', uuidv4());
  fs.mkdirSync(tmpDir);

  const imagePaths: string[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const image = imageUrls[i];
    const filePath = path.join(tmpDir, `img${i}.jpg`);

    if (image.startsWith('http')) {
      const res = await fetch(image);
      if (!res.ok) throw new Error(`Failed to fetch image: ${image}`);
      const buffer = await res.buffer();
      fs.writeFileSync(filePath, buffer);
    } else {
      fs.copyFileSync(image, filePath);
    }

    imagePaths.push(filePath);
  }

  const inputFileList = path.join(tmpDir, 'images.txt');
  const durationPerImage = 5;

  const content = imagePaths.map(p => `file '${p}'\nduration ${durationPerImage}`).join('\n');
  const lastImage = `file '${imagePaths[imagePaths.length - 1]}'`;

  fs.writeFileSync(inputFileList, `${content}\n${lastImage}\n${lastImage}`);

  const outputPath = path.join(tmpDir, 'final.mp4');

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputFileList)
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
      .save(outputPath)
      .on('start', (commandLine: string) => {
        console.log('🎬 FFmpeg started with command:', commandLine);
      })
      .on('end', () => {
        console.log('✅ FFmpeg finished. Video created at:', outputPath);
        resolve(outputPath);
      })
      .on('error', (err: any) => {
        console.error('❌ FFmpeg error:', err);
        reject(err);
      });
  });
}
