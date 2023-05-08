import { spawn } from 'child_process';

export default (...args: string[]) =>
    new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', args)
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve(null)
            } else {
                reject()
            }
        })
    });

