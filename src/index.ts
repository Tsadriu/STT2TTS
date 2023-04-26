require("dotenv").config();

import express from "express";
import path from "path";
import fs from "fs";
import { v2 } from "@google-cloud/translate";
import { SpeechClient } from "@google-cloud/speech";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import bodyParser from "body-parser";
import multer from "multer";
import FFMPEG from "./ffmpeg";

const app = express();

app.use(bodyParser.urlencoded({ extended: true }))

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

app.get("/error", (req, res) => {
    res.render('error', {
        error: "Errore sconosciuto.",
        title: "Errore",
    });
})

app.get("/result", (req, res) => {
    res.render('result', {
        sourceLanguage: "Italiano",
        targetLanguage: "Inglese",
        sourceText: "Ciao, come stai?",
        targetText: "Hello, how are you?",
        audioSrc: "/output/1.mp3",
        title: "Risultato",
    });
});

app.post("/", upload.single("audioFile"), async function (req, res) {
    if (!req.file) {
        res.render('error', {
            error: "File non fornito.",
            title: "Errore",
        });
        return;
    }
    console.log(req.file);
    try {
        // Insert FFMPEG to MP3 here
        // -b:a 48k // Set output audio bitrate to 48000

        await FFMPEG(
            "-i", req.file.path,
            "-c:a", "libopus",
            "-b:a", "48k",
            path.resolve("uploads", `${req.file.filename}.ogg`)
        );

        const buffer = fs.readFileSync(path.resolve("uploads", `${req.file.filename}.ogg`));

        // Extract text from audio
        let textFromAudio = await speechToText(buffer, req.body.fromLanguage);

        // Determine the selected language of the user.
        const translatedText = await translate(textFromAudio, req.body.toLanguage, req.body.fromLanguage);

        // Synthetize voice from text
        let textToSpeechData = await textToSpeech(translatedText, req.body.toLanguage)

        // Uint8Array|string|null textToSpeechData.audioContent

        fs.createWriteStream(path.resolve("output", `${req.file.filename}.mp3`)).write(textToSpeechData.audioContent);

        try {
            fs.rmSync(path.resolve("uploads", `${req.file.filename}.ogg`));
        } catch (e) {
            console.error(e);
        }

        res.render("result", {
            sourceLanguage: getLanguageName(req.body.fromLanguage),
            targetLanguage: getLanguageName(req.body.toLanguage),
            sourceText: textFromAudio,
            targetText: translatedText,
            audioSrc: `/output/${req.file.filename}.mp3`,
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

app.use("/output/", express.static('output'));
app.use(express.static('static'));

app.use((req, res, next) => {
    res.status(404).render("error", {
        error: "404 - Pagina non trovata",
        title: "Errore",
    });
});

app.listen(process.env.port, onReady);