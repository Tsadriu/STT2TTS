let recordButton = document.getElementById("recordBtn");
let selectAudioButton = document.getElementById("audioFile");
let recordId = document.getElementById("recordId");
let isRecording = false;
let stream;
let mediaRecorder;
let chunks = []

async function record() {
    if (isRecording) {
        let tracks = stream.getAudioTracks();
        let track = tracks[0];
        track.stop();

        return;
    }

    try {
        recordButton.innerText = "In attesa del permesso...";
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();

        mediaRecorder.ondataavailable = function (e) {
            chunks.push(e.data);
        }

        mediaRecorder.onstop = async function (e) {
            isRecording = false;
            recordButton.innerText = "Carico...";
            let result = await upload();
            if (result.ok) {
                selectAudioButton.required = false;
                recordButton.innerText = "Caricato!";
            } else {
                console.log(result.error);
                recordButton.innerText = "Errore!";
            }
        }

        isRecording = true;
        recordButton.innerText = "Ferma";
    } catch (e) {
        recordButton.innerText = "Permesso negato";
        recordButton.disabled = true;
        recordButton.classList.add("disabled");
    }
}

async function upload() {
    let blob = chunks[0];
    let res = await fetch("/uploadblob", {
        method: "POST",
        body: chunks[0],
        headers: {
            "Content-Type": blob.type,
        }
    });
    let data = await res.json();
    console.log(data);
    if (data.ok) {
        recordId.value = data.fileId;
    }
    return data;
}

recordButton.addEventListener("click", record);