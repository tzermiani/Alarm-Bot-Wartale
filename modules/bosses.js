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

let lastAlertaHg = 60; //minutos

//funcao checkHGTime
function checkHGTime() {
  //faz um get na api do wartale para pegar o horario do hg
  //https://www.wartaletools.com/api 
  const axios = require('axios');
  var config =  {
    "headers": {
      "accept": "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
      "en": "gsi",
      "priority": "u=1, i",
      "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Microsoft Edge\";v=\"140\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors","sec-fetch-site": "same-origin",
      "Referer": "https://www.wartaletools.com/boss"},
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
      if (hgTimeSpan <= 300 && lastAlertaHg > 5) { //5 minutos  
        lastAlertaHg = 5;
        alerta = '⏰ Falta 5 minutos para o Hell\'s Gate!';
      }else if (lastAlertaHg === 5 && hgTimeSpan > 60) { //reseta o ultimo alerta se o hgTimeSpan for maior que 60 minutos
        lastAlertaHg = 100;
      }

      if (alerta) {
        // Envie o alerta para todos os canais cadastrados
        for (const [canalId] of bossAlarms) {
          const canal = global.discordClient?.channels?.cache?.get(canalId);
          if (canal) {
            canal.send(`🚨 ${alerta}`);
          }
        }
        console.log(alerta);
      } else {
        console.log(`Horário do HG: ${hgTimeSpan}`);
      }
    })
    .catch(error => {
      console.error('Erro ao buscar horário do HG:', error);
    });
}

module.exports = { bossAlarms, checkBosses, handleBossCommands, responderProximosBosses, checkHGTime };