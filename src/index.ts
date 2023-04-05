require("dotenv").config();

import express from "express";
import path from "path";
import fs from "fs";
import { v2 } from "@google-cloud/translate";
import { SpeechClient } from "@google-cloud/speech";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import bodyParser from "body-parser";
import multer from "multer";
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

const app = express();

app.use(bodyParser.urlencoded({ extended: true }))

const translateClient = new v2.Translate();

const speechClient = new SpeechClient({
    projectId: 'progetto-ats',
    keyFilename: 'credentials.json',
});

const ttsClient = new TextToSpeechClient();

const ffmpeg = createFFmpeg({
    log: true,
});

const upload = multer({ dest: 'uploads/' })

/**
 * Type of Language that holds the language-tag and language name.
 */
type Language = {
    code: string,
    name: string,
}

/** 
 * Lista di lingue che saranno in cache.
*/
let languageList: Language[] = [];

/**
 * Translates a text from a language to another language.
 * @param text The text of the audio.
 * @param language The original language of the audio selected by the user.
 * @param from The output language selected by the user.
 * @returns 
 */
async function translate(text: string, language?: string, from?: string): Promise<string> {
    let data = await translateClient.translate(text, {
        from: from,
        to: language,
    });

    return data[0];
}

async function speechToText(buffer: string | Uint8Array, language: string): Promise<string> {
    const [response] = await speechClient.recognize({
        config: {
            encoding: "ENCODING_UNSPECIFIED",
            sampleRateHertz: 48000,
            languageCode: language,
            audioChannelCount: 2,
        },
        audio: {
            content: buffer,
        },
    });

    console.log(response);

    if (!response.results || response.results.length == 0) {
        throw new Error("Could not recognize voice");
    }

    const alternatives = response.results[0].alternatives;
    if (!alternatives || alternatives.length == 0) {
        throw new Error("Could not recognize voice");
    }

    const text = alternatives[0].transcript;
    if (!text) {
        throw new Error("Could not recognize voice");
    }

    return text;
}

async function textToSpeech(text: string, language: string) {
    const ttsResponse = await ttsClient.synthesizeSpeech({
        input: {
            text: text,
        },
        voice: { languageCode: language, ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3' },
    });

    let ttsData = ttsResponse[0];
    return ttsData;
}

/**
 * Caches the languages received from the google API.
 */
async function cacheLanuages() {
    [languageList] = await translateClient.getLanguages();
}

async function onReady() {
    console.log("Listening on port " + process.env.port);
    await cacheLanuages();
}

app.set('view engine', 'ejs');
app.set('views', 'views');

app.get("/", (req, res) => {
    res.render('index', {
        languages: languageList
    });
});

app.post("/", multer().single("audioFile"), async function (req, res) {
    if (!req.file) {
        res.status(400).send("No file provided");
        return;
    }
    console.log(req.file);
    try {
        // Insert FFMPEG to MP3 here
        // -b:a 48k // Set output audio bitrate to 48000

        

        // Extract text from audio
        let textFromAudio = await speechToText(req.file.buffer, req.body.fromLanguage);

        // Determine the selected language of the user.
        const translatedText = await translate(textFromAudio, req.body.toLanguage, req.body.fromLanguage);

        // Synthetize voice from text
        let textToSpeechData = await textToSpeech(translatedText, req.body.toLanguage)

        res.setHeader("Content-Type", "audio/mp3");
        res.send(textToSpeechData.audioContent);
    } catch (e) {
        console.error(e);
        res.status(500).send("Error while processing the audio file: " + e);
        res.end();
        return;
    }
});

app.use(express.static('static'));
app.listen(process.env.port, onReady);