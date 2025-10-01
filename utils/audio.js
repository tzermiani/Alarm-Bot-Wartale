const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
  NoSubscriberBehavior
} = require('@discordjs/voice');
const fs = require('fs');
const { DateTime } = require('luxon');



// Mapa para controlar execuções simultâneas por servidor (guild)
const guildQueues = new Map(); // guildId -> [{ canalDeVoz, caminho }]
const activeGuilds = new Set(); // guildId atualmente tocando


async function tocarAudio(canalDeVoz, caminho) {
  const guildId = canalDeVoz.guild.id;
  // Adiciona pedido à fila do servidor
  if (!guildQueues.has(guildId)) {
    guildQueues.set(guildId, []);
  }
  guildQueues.get(guildId).push({ canalDeVoz, caminho });

  // Se já está tocando áudio neste servidor, apenas aguarda na fila
  if (activeGuilds.has(guildId)) {
    console.warn(`⚠️ Já existe áudio tocando no servidor ${canalDeVoz.guild.name}. Pedido adicionado à fila.`);
    return;
  }

  // Inicia processamento da fila
  await processGuildQueue(guildId);
}

async function processGuildQueue(guildId) {
  const queue = guildQueues.get(guildId);
  if (!queue || queue.length === 0) {
    activeGuilds.delete(guildId);
    return;
  }
  const { canalDeVoz, caminho } = queue[0];
  activeGuilds.add(guildId);

  const connection = joinVoiceChannel({
    channelId: canalDeVoz.id,
    guildId: canalDeVoz.guild.id,
    adapterCreator: canalDeVoz.guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  if (connection.state.status === 'destroyed') {
    console.log('⚠️ Conexão já destruída. Abortando.');
    queue.shift();
    activeGuilds.delete(guildId);
    await processGuildQueue(guildId);
    return;
  }
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  } catch (error) {
    console.error('❌ Falha ao conectar no canal de voz:', error);
    safeDestroy(connection);
    queue.shift();
    activeGuilds.delete(guildId);
    await processGuildQueue(guildId);
    return;
  }

  if (!fs.existsSync(caminho)) {
    console.error('Arquivo especificado não encontrado: ' + caminho);
    safeDestroy(connection);
    queue.shift();
    activeGuilds.delete(guildId);
    await processGuildQueue(guildId);
    return;
  }

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play }
  });

  const resource = createAudioResource(caminho);
  player.play(resource);
  connection.subscribe(player);

  player.on(AudioPlayerStatus.Playing, () => {
    const now = DateTime.now().setZone('America/Sao_Paulo');
    console.log(now.toFormat('dd/MM/yyyy HH:mm') + ':🔊 O áudio está tocando...');
  });

  const finish = async () => {
    const now = DateTime.now().setZone('America/Sao_Paulo');
    console.log(now.toFormat('dd/MM/yyyy HH:mm') + ':⏹️ O áudio terminou');
    safeDestroy(connection);
    queue.shift();
    activeGuilds.delete(guildId);
    await processGuildQueue(guildId);
  };

  player.on(AudioPlayerStatus.Idle, finish);
  player.on('error', async (err) => {
    const now = DateTime.now().setZone('America/Sao_Paulo');
    console.error(now.toFormat('dd/MM/yyyy HH:mm') + ':❌ Erro ao tocar o áudio:', err);
    safeDestroy(connection);
    queue.shift();
    activeGuilds.delete(guildId);
    await processGuildQueue(guildId);
  });
}

function safeDestroy(connection) {
  if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
    console.log('🛠️ Destruindo conexão de voz...');
    connection.destroy();
  } else {
    console.log('⚠️ Tentativa de destruir uma conexão já destruída.');
  }
}

module.exports = { tocarAudio };