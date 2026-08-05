const arquivo = document.getElementById("arquivo");
const player = document.getElementById("player");
const nomeMusica = document.getElementById("nomeMusica");
const status = document.getElementById("status");
const btnAtivar = document.getElementById("remover");
const btnDownload = document.getElementById("download");
const sliderIntensidade = document.getElementById("intensidade");
const sliderGraves = document.getElementById("graves");
const valorIntensidade = document.getElementById("valorIntensidade");
const valorGraves = document.getElementById("valorGraves");

const AudioContextRef = window.AudioContext || window.webkitAudioContext;

let arrayBufferOriginal = null;
let urlOriginal = null;
let audioCtx = null;
let grafo = null; // referências aos nós do grafo, pra mexer ao vivo

arquivo.addEventListener("change", async function () {
    const musica = this.files[0];
    if (!musica) return;

    if (urlOriginal) URL.revokeObjectURL(urlOriginal);

    nomeMusica.innerText = musica.name;
    arrayBufferOriginal = await musica.arrayBuffer();
    urlOriginal = URL.createObjectURL(musica);
    player.src = urlOriginal;

    btnDownload.style.display = "none";
    sliderIntensidade.disabled = true;
    sliderGraves.disabled = true;
    sliderIntensidade.value = 0;
    valorIntensidade.innerText = "0%";
    status.innerText = "Status: Pronto. Clica em Play, depois em Ativar Efeito.";

    // aviso cedo se o ficheiro for mono (a técnica só funciona em estéreo)
    try {
        const ctxTeste = new AudioContextRef();
        const copia = arrayBufferOriginal.slice(0);
        const bufferTeste = await ctxTeste.decodeAudioData(copia);
        if (bufferTeste.numberOfChannels < 2) {
            status.innerText = "Status: Este ficheiro é mono — a remoção de voz não funciona (precisa de estéreo).";
        }
        ctxTeste.close();
    } catch (e) {
        // se não conseguir decodificar aqui, deixa passar; o erro real aparece ao ativar
    }
});

document.getElementById("play").addEventListener("click", () => {
    player.play();
});

document.getElementById("pause").addEventListener("click", () => {
    player.pause();
});

btnAtivar.addEventListener("click", () => {
    if (!arrayBufferOriginal) {
        status.innerText = "Status: Carrega uma música primeiro.";
        return;
    }

    if (grafo) {
        status.innerText = "Status: Efeito já ativo — usa os controles abaixo.";
        return;
    }

    audioCtx = new AudioContextRef();
    const fonte = audioCtx.createMediaElementSource(player);
    grafo = construirGrafo(audioCtx, fonte, 0, Number(sliderGraves.value));
    grafo.saida.connect(audioCtx.destination);

    sliderIntensidade.disabled = false;
    sliderGraves.disabled = false;
    btnDownload.style.display = "block";
    status.innerText = "Status: Efeito ativo! Arrasta 'Intensidade' para tirar a voz aos poucos.";
});

sliderIntensidade.addEventListener("input", () => {
    const intensidade = Number(sliderIntensidade.value) / 100;
    valorIntensidade.innerText = sliderIntensidade.value + "%";
    if (grafo) {
        grafo.wetGain.gain.value = intensidade;
        grafo.dryHighGain.gain.value = 1 - intensidade;
        grafo.saida.gain.value = 1 + intensidade * 0.6;
    }
});

sliderGraves.addEventListener("input", () => {
    const corte = Number(sliderGraves.value);
    valorGraves.innerText = corte + " Hz";
    if (grafo) {
        grafo.wetHighpass.frequency.value = corte;
        grafo.dryHighpass.frequency.value = corte;
        grafo.dryLowpass.frequency.value = corte;
    }
});

btnDownload.addEventListener("click", async (ev) => {
    ev.preventDefault();
    status.innerText = "Status: Gerando ficheiro para download...";

    try {
        const copia = arrayBufferOriginal.slice(0);
        const ctxTemp = new AudioContextRef();
        const bufferDecodificado = await ctxTemp.decodeAudioData(copia);
        ctxTemp.close();

        const offlineCtx = new OfflineAudioContext(
            2,
            bufferDecodificado.length,
            bufferDecodificado.sampleRate
        );

        const fonteOffline = offlineCtx.createBufferSource();
        fonteOffline.buffer = bufferDecodificado;

        const intensidadeAtual = Number(sliderIntensidade.value) / 100;
        const corteAtual = Number(sliderGraves.value);
        const grafoOffline = construirGrafo(offlineCtx, fonteOffline, intensidadeAtual, corteAtual);
        grafoOffline.saida.connect(offlineCtx.destination);

        fonteOffline.start(0);
        const bufferRenderizado = await offlineCtx.startRendering();

        normalizarPico(bufferRenderizado, 0.95);

        const blobWav = paraWavEstereo(bufferRenderizado);
        const urlDownload = URL.createObjectURL(blobWav);

        const link = document.createElement("a");
        link.href = urlDownload;
        link.download = nomeMusica.innerText.replace(/\.[^/.]+$/, "") + "-sem-voz.wav";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        status.innerText = "Status: Download pronto!";
    } catch (erro) {
        console.error(erro);
        status.innerText = "Status: Erro ao gerar o download.";
    }
});

// Monta o grafo de áudio: separa L e R, cancela o centro (L - R),
// protege os graves (abaixo do corte fica sempre intacto) e mistura
// tudo de volta conforme a intensidade escolhida.
function construirGrafo(ctx, source, intensidadeInicial, corteInicial) {
    const splitter = ctx.createChannelSplitter(2);
    source.connect(splitter);

    const invertR = ctx.createGain();
    invertR.gain.value = -1;
    splitter.connect(invertR, 1);

    const somaCancelada = ctx.createGain(); // L + (-R) = L - R
    splitter.connect(somaCancelada, 0);
    invertR.connect(somaCancelada);

    const merger = ctx.createChannelMerger(2);
    somaCancelada.connect(merger, 0, 0);
    somaCancelada.connect(merger, 0, 1);

    const wetHighpass = ctx.createBiquadFilter();
    wetHighpass.type = "highpass";
    wetHighpass.frequency.value = corteInicial;
    merger.connect(wetHighpass);

    const wetGain = ctx.createGain();
    wetGain.gain.value = intensidadeInicial;
    wetHighpass.connect(wetGain);

    const dryHighpass = ctx.createBiquadFilter();
    dryHighpass.type = "highpass";
    dryHighpass.frequency.value = corteInicial;
    source.connect(dryHighpass);

    const dryHighGain = ctx.createGain();
    dryHighGain.gain.value = 1 - intensidadeInicial;
    dryHighpass.connect(dryHighGain);

    const dryLowpass = ctx.createBiquadFilter();
    dryLowpass.type = "lowpass";
    dryLowpass.frequency.value = corteInicial;
    source.connect(dryLowpass);

    const mixSaida = ctx.createGain();
    wetGain.connect(mixSaida);
    dryHighGain.connect(mixSaida);
    dryLowpass.connect(mixSaida);

    // Compensação de volume: quanto mais voz é cancelada, mais energia se perde,
    // então reforçamos o ganho de saída proporcionalmente à intensidade.
    const saida = ctx.createGain();
    saida.gain.value = 1 + intensidadeInicial * 0.6;
    mixSaida.connect(saida);

    return { saida, mixSaida, wetGain, dryHighGain, dryLowpass, wetHighpass, dryHighpass };
}

// Sobe o volume do buffer inteiro até o pico chegar em `picoAlvo` (0-1),
// sem nunca cortar (clipping) — só ajusta se o áudio estiver baixo.
function normalizarPico(audioBuffer, picoAlvo) {
    let pico = 0;
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        const dados = audioBuffer.getChannelData(c);
        for (let i = 0; i < dados.length; i++) {
            const abs = Math.abs(dados[i]);
            if (abs > pico) pico = abs;
        }
    }

    if (pico === 0 || pico >= picoAlvo) return; // já está alto o suficiente (ou é silêncio)

    const ganho = picoAlvo / pico;
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        const dados = audioBuffer.getChannelData(c);
        for (let i = 0; i < dados.length; i++) {
            dados[i] *= ganho;
        }
    }
}

// Converte um AudioBuffer estéreo (resultado do OfflineAudioContext) num Blob WAV de 16 bits.
function paraWavEstereo(audioBuffer) {
    const numCanais = 2;
    const sampleRate = audioBuffer.sampleRate;
    const canalEsq = audioBuffer.getChannelData(0);
    const canalDir = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : canalEsq;
    const tamanho = canalEsq.length;
    const bytesPorAmostra = 2;
    const buffer = new ArrayBuffer(44 + tamanho * numCanais * bytesPorAmostra);
    const view = new DataView(buffer);

    function escreverString(offset, texto) {
        for (let i = 0; i < texto.length; i++) {
            view.setUint8(offset + i, texto.charCodeAt(i));
        }
    }

    escreverString(0, "RIFF");
    view.setUint32(4, 36 + tamanho * numCanais * bytesPorAmostra, true);
    escreverString(8, "WAVE");
    escreverString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numCanais, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numCanais * bytesPorAmostra, true);
    view.setUint16(32, numCanais * bytesPorAmostra, true);
    view.setUint16(34, 16, true);
    escreverString(36, "data");
    view.setUint32(40, tamanho * numCanais * bytesPorAmostra, true);

    let offset = 44;
    for (let i = 0; i < tamanho; i++) {
        const l = Math.max(-1, Math.min(1, canalEsq[i]));
        const r = Math.max(-1, Math.min(1, canalDir[i]));
        view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
        offset += 2;
        view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7fff, true);
        offset += 2;
    }

    return new Blob([view], { type: "audio/wav" });
}
