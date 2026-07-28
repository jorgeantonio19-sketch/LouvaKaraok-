const arquivo = document.getElementById("arquivo");
const player = document.getElementById("player");
const nomeMusica = document.getElementById("nomeMusica");
const status = document.getElementById("status");

arquivo.addEventListener("change", function () {
    const musica = this.files[0];

    if (!musica) return;

    nomeMusica.textContent = musica.name;
    player.src = URL.createObjectURL(musica);
    status.textContent = "Status: Música carregada.";
});

document.getElementById("play").addEventListener("click", () => {
    player.play();
});

document.getElementById("pause").addEventListener("click", () => {
    player.pause();
});

document.getElementById("remover").addEventListener("click", () => {
    status.textContent = "Status: Em breve teremos IA para remover a voz.";
});