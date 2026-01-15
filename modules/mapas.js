// modules/mapas.js
const fs = require('fs');
const { tocarAudio } = require('../utils/audio');
const { DateTime } = require('luxon');
const { getGuildConfig, updateGuildConfig } = require('./bosses');

const mapas = JSON.parse(fs.readFileSync('./mapas.json', 'utf-8'));

async function handleMapCommands(message) {
  const { content, channel, guild } = message;
  const guildId = guild?.id;

  if (!guildId) return;

  if (content === '!map-alarm-here') {
    const config = getGuildConfig(guildId);
    if (!config) {
      // Criar configuração padrão para a guild
      updateGuildConfig(guildId, {
        nome: guild.name,
        canalMapa: channel.id,
        bossChannels: [],
        mapChannels: [],
        timeboss: [3, 5],
        timemap: [3]
      });
      channel.send('✅ Alarme de mapas ativado neste servidor!').then(msg => setTimeout(() => msg.delete(), 5000));
    } else {
      updateGuildConfig(guildId, { canalMapa: channel.id });
      channel.send('✅ Canal de alarme de mapas atualizado!').then(msg => setTimeout(() => msg.delete(), 5000));
    }
    message.delete().catch(() => {});
  }

  if (content === '!stop-map-alarm') {
    const config = getGuildConfig(guildId);
    if (config && config.canalMapa) {
      updateGuildConfig(guildId, { canalMapa: null });
      message.delete().catch(() => {});
      channel.send('🛑 Alarme de mapas desativado.').then(msg => setTimeout(() => msg.delete(), 5000));
    }
  }
}

function checkMapas(client) {
  const now = DateTime.now().setZone('America/Sao_Paulo');
  const horaAtual = now.toFormat('HH:mm');

  // Carregar guilds.json diretamente
  const guildsPath = './guilds.json';
  let guilds = {};
  if (fs.existsSync(guildsPath)) {
    guilds = JSON.parse(fs.readFileSync(guildsPath, 'utf-8'));
  }

  for (const [guildId, guildConfig] of Object.entries(guilds)) {
    if (!guildConfig.canalMapa) continue;
    
    const canal = client.channels.cache.get(guildConfig.canalMapa);
    if (!canal) continue;

    const timemap = guildConfig.timemap || [3];
    const mapChannels = guildConfig.mapChannels || [];
    
    // Para cada tempo de alerta configurado na guild
    for (const minutos of timemap) {
      const horaAlerta = now.plus({ minutes: minutos }).toFormat('HH:mm');
      const mapasAlerta = mapas.filter(m => m.horarios.includes(horaAlerta));
      
      if (mapasAlerta.length > 0) {
        // Toca áudio com sufixo do tempo (ex: mapa-3.mp3)
        const audioPath = `./audios/mapas/${mapasAlerta[0].nome}-${minutos}.mp3`;
        // Fallback para áudio sem sufixo se não existir
        const audioFinal = fs.existsSync(audioPath) 
          ? audioPath 
          : `./audios/mapas/${mapasAlerta[0].nome}.mp3`;
        
        // Tocar áudio em cada canal de voz configurado
        for (const voiceChannelId of mapChannels) {
          const voiceChannel = client.channels.cache.get(voiceChannelId);
          if (!voiceChannel) continue;
          
          // Verifica se há membros no canal (excluindo bots)
          const membersCount = voiceChannel.members.filter(m => !m.user.bot).size;
          if (membersCount === 0) {
            console.log(`⏭️ Pulando canal ${voiceChannel.name} - sem membros`);
            continue;
          }
          
          tocarAudio(voiceChannel, audioFinal);
        }
      }
    }
    
    // Verifica mapas no horário atual
    const mapasNow = mapas.filter(m => m.horarios.includes(horaAtual));
    if (mapasNow.length > 0) {
      for (const voiceChannelId of mapChannels) {
        const voiceChannel = client.channels.cache.get(voiceChannelId);
        if (!voiceChannel) continue;
        
        const membersCount = voiceChannel.members.filter(m => !m.user.bot).size;
        if (membersCount === 0) continue;
        
        tocarAudio(voiceChannel, `./audios/mapas/${mapasNow[0].nome}.mp3`);
      }
      
      const msg = mapasNow.map(m => `📍 Mapa disponível agora: **${m.nome}**`).join('\n');
      canal.send(msg).then(m => setTimeout(() => m.delete(), 60000));
    }
  }
}

function responderProximosMapas(message) {
  const now = DateTime.now().setZone('America/Sao_Paulo');
  const horaAtual = now.hour;
  const proximaHora = (horaAtual + 1) % 24;
  const horariosAlvo = [`${horaAtual.toString().padStart(2, '0')}`, `${proximaHora.toString().padStart(2, '0')}`];

  const mapasProximos = mapas.flatMap(m =>
    m.horarios
      .filter(h => horariosAlvo.includes(h.slice(0, 2)))
      .map(h => ({ nome: m.nome, horario: h }))
  ).sort((a, b) => a.horario.localeCompare(b.horario));

  if (mapasProximos.length === 0) {
    message.channel.send('Nenhum mapa previsto para a próxima hora.');
    return;
  }

  const texto = mapasProximos.map(m => `🕐 ${m.horario} - **${m.nome}**`).join('\n');
  message.channel.send(`🗺️ Próximos mapas da próxima hora:\n${texto}`);
}

module.exports = { checkMapas, handleMapCommands, responderProximosMapas };
