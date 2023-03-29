require("dotenv").config();

import express from "express";
import path from "path";
import fs from "fs";
import { v2 } from "@google-cloud/translate";
import { SpeechClient } from "@google-cloud/speech";
import bodyParser from "body-parser";
import multer from "multer";

const app = express();

app.use(bodyParser.urlencoded({ extended: true }))

const translateClient = new v2.Translate();

const speechClient = new SpeechClient({
    projectId: 'progetto-ats',
    keyFilename: 'credentials.json',
});

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

async function translate(text: string, language?: string, from?: string): Promise<string> {
    let data = await translateClient.translate(text, {
        from: from,
        to: language,
    });

    return data[0];
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
    try {
        const [response] = await speechClient.recognize({
            config: {
                encoding: "ENCODING_UNSPECIFIED",
                sampleRateHertz: 44100,
                languageCode: 'en-US',
                audioChannelCount: 2,
            },
            audio: {
                content: req.file.buffer,
            },
        });

        // console.log(response);

        if (!response.results || response.results.length == 0) {
            return;
        }

        const alternatives = response.results[0].alternatives;
        if (!alternatives || alternatives.length == 0) {
            return;
        }

        const text = alternatives[0].transcript;
        if (!text) {
            return;
        }

        // Determine the selected language of the user.
        const translatedText = await translate(text, req.body.toLanguage, req.body.fromLanguage);

        res.send(translatedText);
    } catch (e) {
        console.error(e);
        res.status(500).send("Error while processing the audio file");
        res.end();
        return;
    }

});

app.use(express.static('static'));
app.listen(process.env.port, onReady);