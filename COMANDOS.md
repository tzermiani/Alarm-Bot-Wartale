# 📋 Comandos do Alarm Bot Wartale

## 🔧 Sistema de Configuração por Guild (Servidor)

O bot agora usa um sistema de configuração centralizado por servidor Discord (guild). Cada servidor pode ter seus próprios tempos de alerta personalizados para bosses e mapas.

---

## 📌 Comandos de Configuração

### `!config-guild`
Exibe as configurações atuais do servidor:
- Canal configurado para alarmes de bosses
- Tempos de alerta para bosses (em minutos)
- Canal configurado para alarmes de mapas
- Tempos de alerta para mapas (em minutos)

**Exemplo:**
```
!config-guild
```

---

### `!boss-alarm-here`
Ativa ou atualiza o canal de alarmes de bosses no servidor.

**Comportamento:**
- Se o servidor não tem configuração, cria uma nova com valores padrão
- Se já existe configuração, atualiza apenas o canal

**Valores padrão:**
- `timeboss: [3, 5]` - Alertas 3 e 5 minutos antes do spawn
- `timemap: [3]` - Alertas 3 minutos antes do mapa

**Exemplo:**
```
!boss-alarm-here
```

---

### `!map-alarm-here`
Ativa ou atualiza o canal de alarmes de mapas no servidor.

**Comportamento:**
- Se o servidor não tem configuração, cria uma nova com valores padrão
- Se já existe configuração, atualiza apenas o canal

**Exemplo:**
```
!map-alarm-here
```

---

### `!stop-boss-alarm`
Desativa os alarmes de bosses no servidor (remove o canal configurado).

**Exemplo:**
```
!stop-boss-alarm
```

---

### `!stop-map-alarm`
Desativa os alarmes de mapas no servidor (remove o canal configurado).

**Exemplo:**
```
!stop-map-alarm
```

---

## ⏰ Configuração de Tempos de Alerta

### `!set-timeboss [minutos...]`
Define os tempos de alerta para bosses (em minutos antes do spawn).

**Suporta múltiplos valores:** Você pode configurar quantos alertas quiser!

**Exemplos:**
```
!set-timeboss 3 5          # Alertas 3 e 5 minutos antes
!set-timeboss 2 5 10       # Alertas 2, 5 e 10 minutos antes
!set-timeboss 1 3 5 10 15  # Alertas 1, 3, 5, 10 e 15 minutos antes
!set-timeboss 0            # Apenas quando o boss nasce (sem alerta prévio)
```

**Notas:**
- Os valores devem ser números inteiros positivos
- O bot tocará áudio específico para cada tempo (se existir)
- Fallback: usa áudio de 2 minutos se não houver áudio específico

---

### `!set-timemap [minutos...]`
Define os tempos de alerta para mapas (em minutos antes do evento).

**Suporta múltiplos valores:** Você pode configurar quantos alertas quiser!

**Exemplos:**
```
!set-timemap 3       # Alerta apenas 3 minutos antes
!set-timemap 2 5     # Alertas 2 e 5 minutos antes
!set-timemap 1 3 10  # Alertas 1, 3 e 10 minutos antes
```

**Notas:**
- Os valores devem ser números inteiros positivos
- O bot tentará usar áudios específicos: `mapa-3.mp3`, `mapa-5.mp3`, etc.
- Fallback: usa áudio padrão do mapa se não houver áudio com sufixo

---

## 🎮 Comandos de Boss

### `!boss-alarm-minute [5|20|35|50]`
Define manualmente o minuto dos horários dos bosses.

**Sistema de rotação automática:**
- Os minutos mudam automaticamente às 19h de cada dia
- Rotação: 5 → 20 → 35 → 50 → 5 → ...

**Exemplo:**
```
!boss-alarm-minute 35
```

---

### `!next-boss`
Lista os próximos bosses da próxima hora.

**Exemplo:**
```
!next-boss
```

**Resposta:**
```
📅 Próximos bosses da próxima hora:
🕐 17:35 - ROTACAO em local desconhecido
🕐 18:35 - TULLA em local desconhecido
```

---

### `!test-boss [HH:MM]`
Testa o sistema de alarmes de boss em um horário específico (requer estar em canal de voz).

**Exemplo:**
```
!test-boss 17:35
```

---

## 🗺️ Comandos de Mapa

### `!next-map`
Lista os próximos mapas da próxima hora.

**Exemplo:**
```
!next-map
```

---

## 🎵 Comandos de Teste

### `!test-audio`
Testa a reprodução de áudio no canal de voz (requer estar em canal de voz).

**Exemplo:**
```
!test-audio
```

---

## 📁 Arquivo guilds.json

As configurações são armazenadas em `guilds.json` na raiz do projeto:

```json
{
  "123456789012345678": {
    "nome": "Nome do Servidor",
    "servidor": "123456789012345678",
    "canalBoss": "987654321098765432",
    "canalMapa": "987654321098765432",
    "timeboss": [3, 5],
    "timemap": [3]
  }
}
```

**Estrutura:**
- `nome`: Nome do servidor Discord
- `servidor`: ID do servidor (guild ID)
- `canalBoss`: ID do canal para alarmes de bosses (ou `null` se desativado)
- `canalMapa`: ID do canal para alarmes de mapas (ou `null` se desativado)
- `timeboss`: Array de inteiros com os minutos antes do spawn para alertar
- `timemap`: Array de inteiros com os minutos antes do mapa para alertar

---

## 🔄 Migração Automática

O bot detecta automaticamente os arquivos antigos (`bossAlarms.json` e `mapAlarms.json`) e migra para o novo sistema na primeira execução:

1. Lê os IDs de canais dos arquivos antigos
2. Extrai o guild ID de cada canal
3. Cria configurações padrão para cada guild
4. Renomeia os arquivos antigos para `.backup`

**Arquivos de backup:**
- `bossAlarms.json.backup`
- `mapAlarms.json.backup`

---

## 🎯 Exemplos de Uso

### Configuração Básica
```
1. !boss-alarm-here     # Ativa alarmes de boss neste canal
2. !map-alarm-here      # Ativa alarmes de mapa neste canal
3. !config-guild        # Verifica configurações
```

### Configuração Avançada
```
1. !boss-alarm-here
2. !set-timeboss 2 5 10      # Alertas 2, 5 e 10 minutos antes
3. !set-timemap 1 3 5        # Alertas 1, 3 e 5 minutos antes
4. !config-guild             # Confirma as mudanças
```

### Desativar Alarmes
```
!stop-boss-alarm   # Desativa bosses
!stop-map-alarm    # Desativa mapas
```

---

## 🆘 Troubleshooting

**"Servidor não configurado"**
- Use `!boss-alarm-here` ou `!map-alarm-here` primeiro

**Áudio não toca**
- Certifique-se de que alguém está em um canal de voz
- O bot se conectará automaticamente ao canal

**Tempos não funcionam**
- Verifique se os valores são números inteiros positivos
- Use `!config-guild` para confirmar as configurações

---

**Desenvolvido para Wartale | Sistema de Guilds v2.0**
