// modules/mapas.js
const fs = require('fs');
const { tocarAudio } = require('../utils/audio');
const { DateTime } = require('luxon');

const mapas = JSON.parse(fs.readFileSync('./mapas.json', 'utf-8'));
const mapAlarmsPath = './mapAlarms.json';
let mapAlarms = new Map();

if (fs.existsSync(mapAlarmsPath)) {
  const canais = JSON.parse(fs.readFileSync(mapAlarmsPath));
  canais.forEach(id => mapAlarms.set(id, true));
}

function salvarMapAlarms() {
  const canais = Array.from(mapAlarms.keys());
  fs.writeFileSync(mapAlarmsPath, JSON.stringify(canais, null, 2));
}

async function handleMapCommands(message) {
  const { content, channel } = message;

  if (content === '!map-alarm-here') {
    if (!mapAlarms.has(channel.id)) {
      mapAlarms.set(channel.id, true);
      salvarMapAlarms();
    }
    message.delete();
    channel.send('✅ Alarme de mapas ativado neste canal!').then(msg => setTimeout(() => msg.delete(), 5000));
  }

  if (content === '!stop-map-alarm') {
    if (mapAlarms.has(channel.id)) {
      mapAlarms.delete(channel.id);
      salvarMapAlarms();
      message.delete();
      channel.send('🛑 Alarme de mapas desativado.').then(msg => setTimeout(() => msg.delete(), 5000));
    }
  }
}

function checkMapas(client) {
  const now = DateTime.now().setZone('America/Sao_Paulo');
  const horaAtual = now.toFormat('HH:mm');
  const hora2Min = now.plus({ minutes: 3 }).toFormat('HH:mm');

  for (const [canalId] of mapAlarms) {
    const canal = client.channels.cache.get(canalId);
    if (!canal) continue;

    const mapas2min = mapas.filter(m => m.horarios.includes(hora2Min));
    const mapasNow = mapas.filter(m => m.horarios.includes(horaAtual));

    if (mapas2min.length > 0){
      tocarAudio(canal, `./audios/mapas/${mapas2min[0].nome}-3.mp3`);
    }
    if (mapasNow.length > 0) {
      tocarAudio(canal, `./audios/mapas/${mapasNow[0].nome}.mp3`);
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

module.exports = { mapAlarms, checkMapas, handleMapCommands, responderProximosMapas };
