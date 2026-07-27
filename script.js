const arquivo = document.getElementById("arquivo");
const player = document.getElementById("player");
const nomeMusica = document.getElementById("nomeMusica");

arquivo.addEventListener("change", function(){

    const musica = this.files[0];

    if(musica){

        nomeMusica.innerText = musica.name;

        player.src = URL.createObjectURL(musica);

    }

});

document.getElementById("play").addEventListener("click", ()=>{

    player.play();

});

document.getElementById("pause").addEventListener("click", ()=>{

    player.pause();

});

const remover = document.getElementById("remover");
const status = document.getElementById("status");

remover.addEventListener("click", () => {

    status.innerText = "Status: Processando...";

    setTimeout(() => {

        status.innerText = "Status: IA ainda não implementada.";

    }, 2000);

});