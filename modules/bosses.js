// modules/bosses.js
const fs = require('fs');
const { execSync } = require('child_process');
const { tocarAudio } = require('../utils/audio');
const { DateTime } = require('luxon');

const bosses = JSON.parse(fs.readFileSync('./bosses.json', 'utf-8'));

// Lista de minutos dos horários dos bosses
const minutosBoss = [5, 20, 35, 50];

// Campo para controlar última data de mudança dos minutos
let minutoBossState = {
  idxMinuto: 0,
  ultimaData: null
};
const bossAlarmsPath = './bossAlarms.json';
let bossAlarms = new Map();

if (fs.existsSync(bossAlarmsPath)) {
  const canais = JSON.parse(fs.readFileSync(bossAlarmsPath));
  canais.forEach(id => bossAlarms.set(id, true));
}

function salvarBossAlarms() {
  const canais = Array.from(bossAlarms.keys());
  fs.writeFileSync(bossAlarmsPath, JSON.stringify(canais, null, 2));
}

async function handleBossCommands(message, client) {
  const { content, channel } = message;

  if (content.includes('!boss-alarm-minute')) {
    const partes = content.split(' ');
    const idx = partes.findIndex(p => p === '!boss-alarm-minute');
    const minutoStr = partes[idx + 1];
    const minuto = Number(minutoStr);
    if (minutosBoss.includes(minuto)) {
      minutoBossState.idxMinuto = minutosBoss.indexOf(minuto);

      //Se a hora for maior que 19, atualiza a data para hoje, senão para ontem
      if(DateTime.now().setZone('America/Sao_Paulo').hour >= 19){
        minutoBossState.ultimaData = DateTime.now().setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd');
      }else{
        minutoBossState.ultimaData = DateTime.now().setZone('America/Sao_Paulo').minus({ days: 1 }).toFormat('yyyy-MM-dd');
      }

      channel.send(`⏰ Minuto do boss alterado para ${minutoStr}.`).then(msg => setTimeout(() => msg.delete(), 5000));
    } else {
      channel.send(`❌ Minuto inválido. Use um dos seguintes: ${minutosBoss.join(', ')}.`).then(msg => setTimeout(() => msg.delete(), 5000));
    }
    return;
  }

  if (content === '!boss-alarm-here') {
    if (!bossAlarms.has(channel.id)) {
      bossAlarms.set(channel.id, true);
      salvarBossAlarms();
    }
    channel.send('✅ Alarme de bosses ativado neste canal!').then(msg => setTimeout(() => msg.delete(), 5000));
    return;
  }

  if (content === '!stop-boss-alarm') {
    if (bossAlarms.has(channel.id)) {
      bossAlarms.delete(channel.id);
      salvarBossAlarms();
      message.delete();
      channel.send('🛑 Alarme de bosses desativado.').then(msg => setTimeout(() => msg.delete(), 5000));
      return;
    }
  }
  if(content.includes("!test-boss ")){
    let time = content.replace("!test-boss ", "")
    const canalDeVoz = message.member.voice.channel;
    if (!canalDeVoz) return message.channel.send('Você precisa estar em um canal de voz!');
    checkBosses(client , time)
    return;
  }
}

function checkBosses(client, time) {
  let now = DateTime.now().setZone('America/Sao_Paulo');

  if (time) {
    const [hour, minute] = time.split(":").map(Number);
    now = now.set({ hour, minute, second: 0, millisecond: 0 });
  }

  // Verifica se precisa mudar o minuto
  const dataAtual = now.toFormat('yyyy-MM-dd');
  if (minutoBossState.ultimaData !== dataAtual && now.hour >= 19) {
    // Incrementa o índice de minutos
    minutoBossState.idxMinuto = (minutoBossState.idxMinuto + 1) % minutosBoss.length;
    minutoBossState.ultimaData = dataAtual;
  }

  const idxMinuto = minutoBossState.idxMinuto;
  const minuto = minutosBoss[(idxMinuto) % minutosBoss.length].toString().padStart(2, '0')
  
  const bossWithHour = bosses.map(boss =>{
    return {
      nome: boss.nome,
      horarios: boss.horarios.map(horario => `${horario}:${minuto}`)
    }
  })

  const horaAtual = now.toFormat('HH:mm');
  const hora2Min = now.plus({ minutes: 2 }).toFormat('HH:mm');
  const hora5Min = now.plus({ minutes: 5 }).toFormat('HH:mm');
  
  for (const [canalId] of bossAlarms) {
    const canal = client.channels.cache.get(canalId);
    if (!canal) continue;

    const bosses5min = bossWithHour.filter(b => b.horarios.includes(hora5Min));
    const bosses2min = bossWithHour.filter(b => b.horarios.includes(hora2Min));
    const bossesNow = bossWithHour.filter(b => b.horarios.includes(horaAtual));

    //if (bosses5min.length > 0) tocarAlertaComBosses(canal, bosses5min, '5-minutos');
    if (bosses2min.length > 0) tocarAlertaComBosses(canal, bosses2min, '2-minutos');
    /*if (bossesNow.length > 0) {
      tocarAlertaComBosses(canal, bossesNow);

      const mensagem = bossesNow.map(b => `🚨 **${b.nome}** apareceu agora em **${b.local || 'local desconhecido'}**!`).join('\n');
      canal.send(mensagem).then(m => setTimeout(() => m.delete(), 60000));
    }*/
  }
}

function responderProximosBosses(message) {
  const now = DateTime.now().setZone('America/Sao_Paulo');
  const horaAtual = now.hour;
  const proximaHora = (horaAtual + 1) % 24;
  const horariosAlvo = [`${horaAtual.toString().padStart(2, '0')}`, `${proximaHora.toString().padStart(2, '0')}`];

  const bossesProximos = bosses.flatMap(b =>
    b.horarios
      .filter(h => horariosAlvo.includes(h.slice(0, 2)))
      .map(h => ({ nome: b.nome, horario: h, local: b.local || 'local desconhecido' }))
  ).sort((a, b) => a.horario.localeCompare(b.horario));

  if (bossesProximos.length === 0) {
    message.channel.send('Nenhum boss previsto para a próxima hora.');
    return;
  }

  const texto = bossesProximos.map(b => `🕐 ${b.horario} - **${b.nome}** em **${b.local}**`).join('\n');
  message.channel.send(`📅 Próximos bosses da próxima hora:\n${texto}`);
}

async function tocarAlertaComBosses(canal, bosses, aviso) {
  const { tocarAudio } = require('../utils/audio');
  const fs = require('fs');
  const { execSync } = require('child_process');

  let avisoFile;
  switch(aviso){
    case '5-minutos':
      avisoFile = 'alerta-boss-5-minutos.mp3'
      break;
      case '2-minutos':
        avisoFile = 'alerta-boss-2-minutos.mp3'
        break;
      default:
        avisoFile = 'alerta-boss-nascendo.mp3'
  }

  if (!fs.existsSync('./audios/cache')) {
    fs.mkdirSync('./audios/cache', { recursive: true });
  }

  // Gerar uma chave baseada nos nomes dos bosses
  const nomes = bosses.map(b => b.nome.replace(/[\\/:"*?<>|\\s]+/g, '').toLowerCase());
  const chave = aviso + '-'+ nomes.sort().join('_');
  const audioCache = `./audios/cache/${chave}.mp3`;

  // Se já existe cache, toca direto
  if (fs.existsSync(audioCache)) {
    console.log(`🔁 Usando áudio cacheado para ${chave}`);
    tocarAudio(canal, audioCache);
    return;
  }

  console.log(`🎙️ Gerando novo áudio para ${chave}...`);

  // Criar input.txt para ffmpeg
  const path = require('path');

const audioPath = path.resolve(__dirname, '../audios');
const inputListPath = path.join(audioPath, 'input.txt');
const outputAudioPath = path.join(audioPath, 'cache', `${chave}.mp3`);

const linhas = [ `file '${path.join(audioPath, avisoFile)}'` ];
for (const boss of bosses) {
  const safeName = boss.nome.replace(/[\\/:"*?<>|\\s]+/g, '');
  linhas.push(`file '${path.join(audioPath, 'bosses', `${safeName}.mp3`)}'`);
}
fs.writeFileSync(inputListPath, linhas.join('\n'));

  // Rodar ffmpeg para criar o áudio
  try {
    execSync(`ffmpeg -f concat -safe 0 -i "${inputListPath}" -c copy "${outputAudioPath}"`);
  } catch (err) {
    console.error('❌ Erro ao concatenar áudios:', err);
    return;
  }

  // Tocar áudio gerado
  tocarAudio(canal, audioCache);

  // Limpar input temporário
  fs.unlinkSync(inputListPath);
}

let lastAlertaHg = true; //minutos

//funcao checkHGTime
function checkHGTime(client) {
  //faz um get na api do wartale para pegar o horario do hg
  //https://www.wartaletools.com/api 
  const axios = require('axios');
  var config =  {
    "headers": {
      "authority":"wartaletools.com",
      "accept":"application/json, text/plain, */*",
      //"accept-encoding":"gzip, deflate, br, zstd",
      "accept-language":"pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "cookie":"_ga=GA1.1.1509123113.1759413058; _ga_6F0240X7XF=GS2.1.s1763608841$o2$g0$t1763608841$j60$l0$h0; __gads=ID=9d5a5f1df684b887:T=1759413058:RT=1763608842:S=ALNI_MZLR_0Z2NVxJ4H0n-qSgy6lHYi0yA; __gpi=UID=00001297745ee50e:T=1759413058:RT=1763608842:S=ALNI_MaCINE2b3tnK2xgO6sxELKaakVkxA; __eoi=ID=563ccd38db838bb3:T=1759413058:RT=1763608842:S=AA-AfjbID7s0QQG96Ig3uPVO4otQ",
      "en":"gsi",
      "priority":"u=1, i",
      "referer":"https://wartaletools.com/boss",
      "sec-ch-ua":'"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
      "sec-ch-ua-mobile":"?0",
      "sec-ch-ua-platform":"Windows",
      "sec-fetch-dest":"empty",
      "sec-fetch-mode":"cors",
      "sec-fetch-site":"same-origin",
      "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
    },
  "body": null,
  "method": "GET"
};

  axios.get('https://www.wartaletools.com/api', config)
    .then(response => {
      // Espera-se que o response.data.results[0].value.Ares.HellsGateNextRound seja um inteiro representando os segundos faltando para o próximo HG
      const hgTimeSpan = response.data?.results?.[0]?.value?.Ares?.HellsGateNextRound;
      if (!hgTimeSpan) {
        console.log('Não foi possível obter o horário do HG.');
        return;
      }

      let alerta = null;
      //verifica quantos segundos faltam para o hgTimeSpan 
      if (hgTimeSpan <= 300) { //5 minutos  
        if(!lastAlertaHg){
          lastAlertaHg = true;
          alerta = '⏰ Falta 5 minutos para o Hell\'s Gate!';
        }
      }else if (lastAlertaHg && hgTimeSpan > 600) { //reseta o ultimo alerta se o hgTimeSpan for maior que 60 minutos
        lastAlertaHg = false;
      }

      if (alerta) {
        // Envie o alerta para todos os canais cadastrados
        for (const [canalId] of bossAlarms) {
          const canal = client.channels.cache.get(canalId);
          if (!canal) continue;
          
          let audio = './audios/HG-5minutos-LULA.mp3';
          tocarAudio(canal, audio);
          
        }
      } 
    })
    .catch(error => {
      console.error('Erro ao buscar horário do HG:', error);
    });
}

module.exports = { bossAlarms, checkBosses, handleBossCommands, responderProximosBosses, checkHGTime };