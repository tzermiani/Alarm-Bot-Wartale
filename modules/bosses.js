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

// Sistema de configuração por Guild
const guildsPath = './guilds.json';
let guilds = {};

function carregarGuilds() {
  if (fs.existsSync(guildsPath)) {
    guilds = JSON.parse(fs.readFileSync(guildsPath, 'utf-8'));
  }
}

function salvarGuilds() {
  fs.writeFileSync(guildsPath, JSON.stringify(guilds, null, 2));
}

function getGuildConfig(guildId) {
  return guilds[guildId] || null;
}

function updateGuildConfig(guildId, config) {
  guilds[guildId] = {
    ...guilds[guildId],
    ...config,
    servidor: guildId
  };
  salvarGuilds();
}

// Carregar configurações ao iniciar
carregarGuilds();

// Migração automática dos arquivos antigos
function migrarAlarmsAntigos(client) {
  const bossAlarmsPath = './bossAlarms.json';
  const mapAlarmsPath = './mapAlarms.json';
  let migrados = false;

  // Migrar bossAlarms.json
  if (fs.existsSync(bossAlarmsPath)) {
    const canaisAntigos = JSON.parse(fs.readFileSync(bossAlarmsPath, 'utf-8'));
    
    for (const canalId of canaisAntigos) {
      const canal = client.channels.cache.get(canalId);
      if (!canal || !canal.guild) continue;
      
      const guildId = canal.guild.id;
      const config = getGuildConfig(guildId);
      
      if (!config) {
        updateGuildConfig(guildId, {
          nome: canal.guild.name,
          canalBoss: canalId,
          bossChannels: [],
          mapChannels: [],
          timeboss: [3, 5],
          timemap: [3]
        });
        migrados = true;
        console.log(`✅ Migrado boss alarm: ${canal.guild.name} -> #${canal.name}`);
      } else if (!config.canalBoss) {
        updateGuildConfig(guildId, { canalBoss: canalId });
        migrados = true;
        console.log(`✅ Atualizado canal boss: ${canal.guild.name} -> #${canal.name}`);
      }
    }
    
    // Renomear arquivo antigo para backup
    fs.renameSync(bossAlarmsPath, `${bossAlarmsPath}.backup`);
    console.log('📦 Backup criado: bossAlarms.json.backup');
  }

  // Migrar mapAlarms.json
  if (fs.existsSync(mapAlarmsPath)) {
    const canaisAntigos = JSON.parse(fs.readFileSync(mapAlarmsPath, 'utf-8'));
    
    for (const canalId of canaisAntigos) {
      const canal = client.channels.cache.get(canalId);
      if (!canal || !canal.guild) continue;
      
      const guildId = canal.guild.id;
      const config = getGuildConfig(guildId);
      
      if (!config) {
        updateGuildConfig(guildId, {
          nome: canal.guild.name,
          canalMapa: canalId,
          bossChannels: [],
          mapChannels: [],
          timeboss: [3, 5],
          timemap: [3]
        });
        migrados = true;
        console.log(`✅ Migrado map alarm: ${canal.guild.name} -> #${canal.name}`);
      } else if (!config.canalMapa) {
        updateGuildConfig(guildId, { canalMapa: canalId });
        migrados = true;
        console.log(`✅ Atualizado canal mapa: ${canal.guild.name} -> #${canal.name}`);
      }
    }
    
    // Renomear arquivo antigo para backup
    fs.renameSync(mapAlarmsPath, `${mapAlarmsPath}.backup`);
    console.log('📦 Backup criado: mapAlarms.json.backup');
  }

  if (migrados) {
    console.log('🎉 Migração concluída! Configurações salvas em guilds.json');
  }
}


async function handleBossCommands(message, client) {
  const { content, channel, guild } = message;
  const guildId = guild?.id;

  if (!guildId) return;

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
    const config = getGuildConfig(guildId);
    if (!config) {
      // Criar configuração padrão para a guild
      updateGuildConfig(guildId, {
        nome: guild.name,
        canalBoss: channel.id,
        bossChannels: [],
        mapChannels: [],
        timeboss: [3, 5],
        timemap: [3]
      });
      channel.send('✅ Alarme de bosses ativado neste servidor!').then(msg => setTimeout(() => msg.delete(), 5000));
    } else {
      updateGuildConfig(guildId, { canalBoss: channel.id });
      channel.send('✅ Canal de alarme de bosses atualizado!').then(msg => setTimeout(() => msg.delete(), 5000));
    }
    return;
  }

  if (content === '!stop-boss-alarm') {
    const config = getGuildConfig(guildId);
    if (config && config.canalBoss) {
      updateGuildConfig(guildId, { canalBoss: null });
      message.delete();
      channel.send('🛑 Alarme de bosses desativado.').then(msg => setTimeout(() => msg.delete(), 5000));
      return;
    }
  }

  if (content === '!config-guild') {
    const config = getGuildConfig(guildId);
    if (!config) {
      channel.send('❌ Servidor não configurado. Use `!boss-alarm-here` ou `!map-alarm-here` para configurar.');
      return;
    }
    
    const canalBoss = config.canalBoss ? `<#${config.canalBoss}>` : 'Não configurado';
    const canalMapa = config.canalMapa ? `<#${config.canalMapa}>` : 'Não configurado';
    const timeboss = config.timeboss?.join(', ') || 'Não configurado';
    const timemap = config.timemap?.join(', ') || 'Não configurado';
    
    const bossChannels = config.bossChannels || [];
    const mapChannels = config.mapChannels || [];
    const bossVoiceList = bossChannels.length > 0 
      ? bossChannels.map(id => {
          const vc = client.channels.cache.get(id);
          return vc ? vc.name : `ID: ${id}`;
        }).join(', ')
      : 'Nenhum configurado';
    const mapVoiceList = mapChannels.length > 0
      ? mapChannels.map(id => {
          const vc = client.channels.cache.get(id);
          return vc ? vc.name : `ID: ${id}`;
        }).join(', ')
      : 'Nenhum configurado';
    
    const mensagem = `⚙️ **Configurações do Servidor: ${config.nome}**\n\n` +
      `🔔 **Canal Texto Boss:** ${canalBoss}\n` +
      `🔊 **Canais Voz Boss:** ${bossVoiceList}\n` +
      `⏰ **Tempos Boss (min):** ${timeboss}\n\n` +
      `🗺️ **Canal Texto Mapa:** ${canalMapa}\n` +
      `🔊 **Canais Voz Mapa:** ${mapVoiceList}\n` +
      `⏰ **Tempos Mapa (min):** ${timemap}\n\n` +
      `**Comandos disponíveis:**\n` +
      `\`!set-timeboss 2 5 10\` - Define tempos de alerta para bosses\n` +
      `\`!set-timemap 3 5\` - Define tempos de alerta para mapas\n` +
      `\`!add-boss-voice\` - Adiciona canal de voz atual para bosses\n` +
      `\`!remove-boss-voice\` - Remove canal de voz atual de bosses\n` +
      `\`!add-map-voice\` - Adiciona canal de voz atual para mapas\n` +
      `\`!remove-map-voice\` - Remove canal de voz atual de mapas`;
    
    channel.send(mensagem);
    return;
  }

  if (content.includes('!set-timeboss')) {
    const partes = content.split(' ').slice(1);
    const tempos = partes.map(Number).filter(n => !isNaN(n) && n >= 0);
    
    if (tempos.length === 0) {
      channel.send('❌ Uso: `!set-timeboss 2 5 10` (números de minutos separados por espaço)');
      return;
    }
    
    const config = getGuildConfig(guildId);
    if (!config) {
      updateGuildConfig(guildId, {
        nome: guild.name,
        timeboss: tempos,
        timemap: [3]
      });
    } else {
      updateGuildConfig(guildId, { timeboss: tempos });
    }
    
    channel.send(`✅ Tempos de alerta de boss atualizados: ${tempos.join(', ')} minutos`).then(msg => setTimeout(() => msg.delete(), 5000));
    return;
  }

  if (content.includes('!set-timemap')) {
    const partes = content.split(' ').slice(1);
    const tempos = partes.map(Number).filter(n => !isNaN(n) && n >= 0);
    
    if (tempos.length === 0) {
      channel.send('❌ Uso: `!set-timemap 3 5` (números de minutos separados por espaço)');
      return;
    }
    
    const config = getGuildConfig(guildId);
    if (!config) {
      updateGuildConfig(guildId, {
        nome: guild.name,
        timeboss: [3, 5],
        timemap: tempos
      });
    } else {
      updateGuildConfig(guildId, { timemap: tempos });
    }
    
    channel.send(`✅ Tempos de alerta de mapa atualizados: ${tempos.join(', ')} minutos`).then(msg => setTimeout(() => msg.delete(), 5000));
    return;
  }
  if (content === '!add-boss-voice') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      channel.send('❌ Você precisa estar em um canal de voz!');
      return;
    }
    
    const config = getGuildConfig(guildId);
    const bossChannels = config?.bossChannels || [];
    
    if (bossChannels.includes(voiceChannel.id)) {
      channel.send('⚠️ Este canal de voz já está configurado para alarmes de boss.');
      return;
    }
    
    bossChannels.push(voiceChannel.id);
    updateGuildConfig(guildId, { bossChannels, nome: guild.name });
    channel.send(`✅ Canal de voz **${voiceChannel.name}** adicionado para alarmes de boss!`).then(msg => setTimeout(() => msg.delete(), 5000));
    return;
  }

  if (content === '!remove-boss-voice') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      channel.send('❌ Você precisa estar em um canal de voz!');
      return;
    }
    
    const config = getGuildConfig(guildId);
    let bossChannels = config?.bossChannels || [];
    
    if (!bossChannels.includes(voiceChannel.id)) {
      channel.send('⚠️ Este canal de voz não está configurado para alarmes de boss.');
      return;
    }
    
    bossChannels = bossChannels.filter(id => id !== voiceChannel.id);
    updateGuildConfig(guildId, { bossChannels });
    channel.send(`✅ Canal de voz **${voiceChannel.name}** removido dos alarmes de boss!`).then(msg => setTimeout(() => msg.delete(), 5000));
    return;
  }

  if (content === '!add-map-voice') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      channel.send('❌ Você precisa estar em um canal de voz!');
      return;
    }
    
    const config = getGuildConfig(guildId);
    const mapChannels = config?.mapChannels || [];
    
    if (mapChannels.includes(voiceChannel.id)) {
      channel.send('⚠️ Este canal de voz já está configurado para alarmes de mapa.');
      return;
    }
    
    mapChannels.push(voiceChannel.id);
    updateGuildConfig(guildId, { mapChannels, nome: guild.name });
    channel.send(`✅ Canal de voz **${voiceChannel.name}** adicionado para alarmes de mapa!`).then(msg => setTimeout(() => msg.delete(), 5000));
    return;
  }

  if (content === '!remove-map-voice') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      channel.send('❌ Você precisa estar em um canal de voz!');
      return;
    }
    
    const config = getGuildConfig(guildId);
    let mapChannels = config?.mapChannels || [];
    
    if (!mapChannels.includes(voiceChannel.id)) {
      channel.send('⚠️ Este canal de voz não está configurado para alarmes de mapa.');
      return;
    }
    
    mapChannels = mapChannels.filter(id => id !== voiceChannel.id);
    updateGuildConfig(guildId, { mapChannels });
    channel.send(`✅ Canal de voz **${voiceChannel.name}** removido dos alarmes de mapa!`).then(msg => setTimeout(() => msg.delete(), 5000));
    return;
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
  
  // Controle para evitar tocar áudio duplicado no mesmo canal
  const canaisJaTocados = new Set();
  
  // Itera sobre as guilds configuradas
  for (const [guildId, guildConfig] of Object.entries(guilds)) {
    if (!guildConfig.canalBoss) continue;
    
    const canal = client.channels.cache.get(guildConfig.canalBoss);
    if (!canal) continue;

    const timeboss = guildConfig.timeboss || [3, 5];
    const bossChannels = guildConfig.bossChannels || [];
    
    // Para cada tempo de alerta configurado na guild
    for (const minutos of timeboss) {
      const horaAlerta = now.plus({ minutes: minutos }).toFormat('HH:mm');
      const bossesAlerta = bossWithHour.filter(b => b.horarios.includes(horaAlerta));
      
      if (bossesAlerta.length > 0) {
        
        const avisoLabel = `${minutos}-minutos`;
        
        // Tocar áudio em cada canal de voz configurado
        for (const voiceChannelId of bossChannels) {
          // Criar chave única para este alerta específico (canal + horário + minutos)
          const chaveAlerta = `${voiceChannelId}-${horaAlerta}-${minutos}`;
          
          // Pula se já tocou neste canal para este alerta
          if (canaisJaTocados.has(chaveAlerta)) {
            console.log(`⏭️ Pulando canal duplicado - já tocou este alerta`);
            continue;
          }
          
          const voiceChannel = client.channels.cache.get(voiceChannelId);
          if (!voiceChannel) continue;
          
          // Verifica se há membros no canal (excluindo bots)
          const membersCount = voiceChannel.members.filter(m => !m.user.bot).size;
          if (membersCount === 0) {
            console.log(`⏭️ Pulando canal ${voiceChannel.name} - sem membros`);
            continue;
          }
          
          // Marca como já tocado
          canaisJaTocados.add(chaveAlerta);
          
          tocarAlertaComBosses(voiceChannel, bossesAlerta, avisoLabel, minutos);
        }
      }
    }
    
    // Verifica spawns no horário atual (opcional)
    const bossesNow = bossWithHour.filter(b => b.horarios.includes(horaAtual));
    if (bossesNow.length > 0 && timeboss.includes(0)) {
      for (const voiceChannelId of bossChannels) {
        // Criar chave única para spawn atual
        const chaveAlerta = `${voiceChannelId}-${horaAtual}-spawn`;
        
        if (canaisJaTocados.has(chaveAlerta)) {
          continue;
        }
        
        const voiceChannel = client.channels.cache.get(voiceChannelId);
        if (!voiceChannel) continue;
        
        const membersCount = voiceChannel.members.filter(m => !m.user.bot).size;
        if (membersCount === 0) continue;
        
        canaisJaTocados.add(chaveAlerta);
        tocarAlertaComBosses(voiceChannel, bossesNow, 'nascendo', 0);
      }
      
      const mensagem = bossesNow.map(b => `🚨 **${b.nome}** apareceu agora!`).join('\n');
      canal.send(mensagem).then(m => setTimeout(() => m.delete(), 60000));
    }
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

async function tocarAlertaComBosses(canal, bosses, aviso, minutos) {
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
    case 'nascendo':
      avisoFile = 'alerta-boss-nascendo.mp3'
      break;
    default:
      // Para tempos customizados, tenta usar arquivo específico ou usa o de 2 minutos como fallback
      avisoFile = fs.existsSync(`./audios/alerta-boss-${minutos}-minutos.mp3`) 
        ? `alerta-boss-${minutos}-minutos.mp3`
        : 'alerta-boss-2-minutos.mp3'
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
        // Controle para evitar tocar áudio duplicado no mesmo canal
        const canaisJaTocados = new Set();
        
        // Envie o alerta para todas as guilds cadastradas
        for (const [guildId, guildConfig] of Object.entries(guilds)) {
          const bossChannels = guildConfig.bossChannels || [];
          
          let audio = './audios/HG-5minutos-LULA.mp3';
          
          for (const voiceChannelId of bossChannels) {
            // Pula se já tocou neste canal
            if (canaisJaTocados.has(voiceChannelId)) {
              console.log(`⏭️ Pulando HG alert - canal duplicado`);
              continue;
            }
            
            const voiceChannel = client.channels.cache.get(voiceChannelId);
            if (!voiceChannel) continue;
            
            // Verifica se há membros no canal (excluindo bots)
            const membersCount = voiceChannel.members.filter(m => !m.user.bot).size;
            if (membersCount === 0) {
              console.log(`⏭️ Pulando HG alert - canal ${voiceChannel.name} sem membros`);
              continue;
            }
            
            // Marca como já tocado
            canaisJaTocados.add(voiceChannelId);
            
            tocarAudio(voiceChannel, audio);
          }
        }
      } 
    })
    .catch(error => {
      console.error('Erro ao buscar horário do HG:', error);
    });
}

module.exports = { checkBosses, handleBossCommands, responderProximosBosses, checkHGTime, getGuildConfig, updateGuildConfig, carregarGuilds, migrarAlarmsAntigos };