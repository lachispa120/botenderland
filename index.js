const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const https = require('https');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// --- CONFIGURACIÓN DE ENDERLAND ---
const TOKEN = process.env.DISCORD_TOKEN;
const SERVER_IP = 'play.enderland.org';
const WEB_URL = 'https://enderland.org';
const DISCORD_LINK = 'https://discord.gg/SFMFn5mDds'; 

// 1. EVENTO AL INICIAR (ESTADO DINÁMICO)
client.once('ready', () => {
    console.log(`✅ Enderland Bot encendido como ${client.user.tag}`);

    const updateStatus = () => {
        https.get(`https://api.mcstatus.io/v2/status/java/${SERVER_IP}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const info = JSON.parse(data);
                    if (info.online) {
                        client.user.setActivity(`${info.players.online}/${info.players.max} en ${SERVER_IP}`, { type: 0 });
                    } else {
                        client.user.setActivity('Servidor Offline 🔴', { type: 3 });
                    }
                } catch (e) {
                    client.user.setActivity(SERVER_IP, { type: 3 });
                }
            });
        }).on('error', () => console.log("Error al conectar con la API de MC"));
    };

    updateStatus();
    setInterval(updateStatus, 60000); // Actualiza cada 1 minuto
});

// 2. COMANDOS
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!') && !message.content.startsWith('/')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // COMANDO IP
    if (command === 'ip') {
        const ipEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎮 ¡Conéctate a Enderland!')
            .addFields(
                { name: '📍 Dirección IP', value: `\`${SERVER_IP}\``, inline: false },
                { name: '🛠️ Versiones', value: 'Desde **1.16.x** hasta **1.21**', inline: false }
            )
            .setFooter({ text: 'Enderland Network' });
        return message.reply({ embeds: [ipEmbed] });
    }

    // COMANDO WEB Y TIENDA
    if (command === 'web') return message.reply(`🌍 **Portal Oficial:** ${WEB_URL}`);
    if (command === 'tienda') return message.reply(`🛒 **Tienda de Enderland:** ${WEB_URL}/tienda`);
    if (command === 'discord') return message.reply(`📢 **Comunidad:** ${DISCORD_LINK}`);

    // COMANDO PLAYERS
    if (command === 'players' || command === 'status') {
        https.get(`https://api.mcstatus.io/v2/status/java/${SERVER_IP}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const info = JSON.parse(data);
                const pEmbed = new EmbedBuilder().setTitle('📊 Estado de Enderland');
                if (info.online) {
                    let lista = info.players.list && info.players.list.length > 0 
                        ? info.players.list.map(p => p.name_clean).join(', ') 
                        : 'No hay nadie conectado.';
                    pEmbed.setColor('#2ecc71').addFields(
                        { name: 'Estado', value: '🟢 Online', inline: true },
                        { name: 'Jugadores', value: `**${info.players.online}** / ${info.players.max}`, inline: true },
                        { name: 'Lista:', value: `\`\`\`${lista}\`\`\`` }
                    );
                } else {
                    pEmbed.setColor('#e74c3c').setDescription('🔴 El servidor está offline.');
                }
                message.reply({ embeds: [pEmbed] });
            });
        });
    }

    // COMANDO STAFF: !msg #canal texto
    if (command === 'msg') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('❌ No tienes permiso.');

        const canal = message.mentions.channels.first() || message.guild.channels.cache.find(c => c.name === args[0]);
        const texto = args.slice(1).join(' ');

        if (!canal || !texto) return message.reply('⚠️ Uso: `!msg #canal texto`');

        canal.send(texto)
            .then(() => {
                message.delete();
                message.channel.send(`✅ Enviado a ${canal}`).then(m => setTimeout(() => m.delete(), 3000));
            })
            .catch(() => message.reply('❌ No tengo permisos en ese canal.'));
    }
});

client.login(TOKEN);