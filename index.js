const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const { tocarAudio } = require('./utils/audio');
const { checkBosses, handleBossCommands, responderProximosBosses, checkHGTime, migrarAlarmsAntigos } = require('./modules/bosses');
const { checkMapas, handleMapCommands, responderProximosMapas } = require('./modules/mapas');


// Carrega configuração conforme ambiente
const env = process.env.NODE_ENV === 'production' ? 'production' : 'homolog';
const configPath = `./config.${env}.json`;
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
  
  // Migrar arquivos antigos para o novo sistema de guilds
  migrarAlarmsAntigos(client);
  
  setInterval(() => {
    checkBosses(client);
    checkMapas(client);
    checkHGTime(client);
  }, 60 * 1000);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const { content } = message;

  if (content === '!test-audio') {
    const canalDeVoz = message.member.voice.channel;
    if (!canalDeVoz) return message.channel.send('Você precisa estar em um canal de voz!');
    tocarAudio(canalDeVoz, './audios/test.mp3');
  }

  if (content === '!next-boss') responderProximosBosses(message);
  if (content === '!next-map') responderProximosMapas(message);

  await handleBossCommands(message,client);
  await handleMapCommands(message);
});

client.login(config.DISCORD_TOKEN);