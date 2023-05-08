require("dotenv").config();

import express from "express";
import path from "path";
import fs from "fs";
import { v2 } from "@google-cloud/translate";
import { SpeechClient } from "@google-cloud/speech";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import bodyParser from "body-parser";
import multer from "multer";
import crypto from "crypto";
import FFMPEG from "./ffmpeg";

const app = express();

app.use(bodyParser.urlencoded({
    extended: true,
    limit: "12mb",
}));

const translateClient = new v2.Translate();

const speechClient = new SpeechClient({
    projectId: 'progetto-ats',
    keyFilename: 'credentials.json',
});

const ttsClient = new TextToSpeechClient();

if (fs.existsSync("uploads")) {
    fs.rmSync("uploads", { recursive: true });
}

const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync("output")) {
    fs.mkdirSync("output");
}

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

function getLanguageName(code: string): string {
    let language = languageList.find((language) => language.code == code);
    if (!language) {
        return code;
    }
    return language.name;
}

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
            encoding: "OGG_OPUS",
            sampleRateHertz: 48000,
            languageCode: language,
            audioChannelCount: 2,
        },
        audio: {
            content: buffer,
        },
    });

    console.log(response);
    console.log(response.results);

    if (response.results) {
        console.log(response.results[0].alternatives)
    }

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

function randomString(length: number = 32) {
    return crypto.randomBytes(length).toString('hex');
}

async function processAudio(filePath: string, fromLanguage: string, toLanguage: string) {
    // -b:a 48k // Set output audio bitrate to 48000

    let fileName = randomString();

    await FFMPEG(
        "-i", filePath,
        "-c:a", "libopus",
        "-b:a", "48k",
        path.resolve("uploads", `${fileName}.ogg`)
    );

    const buffer = fs.readFileSync(path.resolve("uploads", `${fileName}.ogg`));

    // Extract text from audio
    let textFromAudio = await speechToText(buffer, fromLanguage);

    // Determine the selected language of the user.
    const translatedText = await translate(textFromAudio, toLanguage, fromLanguage);

    // Synthetize voice from text
    let textToSpeechData = await textToSpeech(translatedText, toLanguage)

    // Uint8Array|string|null textToSpeechData.audioContent

    fs.createWriteStream(path.resolve("output", `${fileName}.mp3`)).write(textToSpeechData.audioContent);

    try {
        fs.rmSync(path.resolve("uploads", `${fileName}.ogg`));
    } catch (e) {
        console.error(e);
    }

    return {
        fileName: `${fileName}.mp3`,
        sourceText: textFromAudio,
        targetText: translatedText,
    }
}

async function onReady() {
    console.log("Listening on port " + process.env.port);
    await cacheLanuages();
}

app.set('view engine', 'ejs');
app.set('views', 'views');

app.get("/", (req, res) => {
    res.render('index', {
        languages: languageList,
        title: "Speech to text to speech",
    });
});

app.post("/", upload.single("audioFile"), async function (req, res) {
    if (!req.file && req.body.recordId === "") {
        res.render('error', {
            error: "File non fornito.",
            title: "Errore",
        });
        return;
    }

    try {
        let filePath;

        if (req.body.recordId !== "") {
            filePath = `uploads/${req.body.recordId}.ogg`;
        } else if (req.file) {
            filePath = req.file.path
        } else {
            res.status(500);
            res.render("error", {
                error: "File non fornito.",
                title: "Errore",
            })
            return;
        }

        let result = await processAudio(filePath, req.body.fromLanguage, req.body.toLanguage);

        res.render("result", {
            sourceLanguage: getLanguageName(req.body.fromLanguage),
            targetLanguage: getLanguageName(req.body.toLanguage),
            sourceText: result.sourceText,
            targetText: result.targetText,
            audioSrc: `/output/${result.fileName}`,
            title: "Risultato",
        });
    } catch (e) {
        console.error(e);
        res.status(500);
        res.render("error", {
            error: e,
            title: "Errore",
        })
        return;
    }
});

app.post("/uploadblob", express.raw({ type: "audio/*", limit: "128mb"}), async function (req, res) {
    let buffer = req.body;
    let fileId = randomString();
    fs.writeFileSync(path.resolve("uploads", `${fileId}.ogg`), buffer);

    res.json({
        ok: true,
        fileId: fileId,
    });
})

app.use("/output/", express.static('output'));
app.use(express.static('static'));

app.use((req, res, next) => {
    res.status(404).render("error", {
        error: "404 - Pagina non trovata",
        title: "Errore",
    });
});

app.listen(process.env.port, onReady);