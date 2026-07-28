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

// Registrar o Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(() => {
        console.log("Service Worker registrado com sucesso.");
      })
      .catch((erro) => {
        console.log("Erro ao registrar Service Worker:", erro);
      });
  });
}