const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const https = require('https');
const express = require('express');

// --- SERVIDOR WEB (KEEP-ALIVE) ---
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Enderland Bot está funcionando 24/7'));
app.listen(port, () => console.log(`📡 Puerto ${port} activo`));

// --- CLIENTE DISCORD ---
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

// ⚠️ REEMPLAZA ESTOS IDs CON LOS DE TU SERVIDOR
const ROL_MIEMBRO_ID = '1468201851588444210'; // ID de 『👤』 Miembro
const ROL_ANTIMEMBER_ID = 'ID_AQUÍ'; // ID de antimember

client.once('ready', () => {
    console.log(`✅ Enderland Bot encendido como ${client.user.tag}`);
    
    // ESTADO DINÁMICO (JUGADORES EN VIVO)
    setInterval(() => {
        https.get(`https://api.mcstatus.io/v2/status/java/${SERVER_IP}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const info = JSON.parse(data);
                    if (info.online) {
                        client.user.setActivity(`${info.players.online}/${info.players.max} en ${SERVER_IP}`, { type: 0 });
                    }
                } catch (e) { /* Error silencioso */ }
            });
        });
    }, 60000);
});

// --- LÓGICA DE VERIFICACIÓN (BOTONES) ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'verificar_btn') {
        const miembro = interaction.member;

        try {
            // Verificamos si ya tiene el rol para no hacer procesos de más
            if (miembro.roles.cache.has(ROL_MIEMBRO_ID)) {
                return interaction.reply({ content: '✅ Ya estás verificado.', ephemeral: true });
            }

            // ACCIÓN: Poner Miembro y quitar Antimember
            await miembro.roles.add(ROL_MIEMBRO_ID);
            if (miembro.roles.cache.has(ROL_ANTIMEMBER_ID)) {
                await miembro.roles.remove(ROL_ANTIMEMBER_ID);
            }

            await interaction.reply({ content: '🎉 ¡Bienvenido a **Enderland**! Ya puedes ver todos los canales.', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Hubo un problema con los roles. Asegúrate de que mi rol esté arriba de todos.', ephemeral: true });
        }
    }
});

// --- COMANDOS ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // COMANDO SETUP (ENVÍA EL EMBED CON EL BOTÓN)
    if (command === 'setup') {
        if (!message.member.permissions.has('Administrator')) return;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('『✅』 SISTEMA DE VERIFICACIÓN')
            .setAuthor({ name: 'Enderland Network', iconURL: client.user.displayAvatarURL() })
            .setDescription(
                '¡Bienvenido a **Enderland Network**!\n\n' +
                'Para acceder a la comunidad y desbloquear todos los canales, haz clic en el botón de abajo.\n\n' +
                '**¿Por qué verificarse?**\n' +
                '• Evitamos el ingreso de bots y raids.\n' +
                '• Aseguramos una comunidad limpia.\n' +
                '• Confirmas que has leído las reglas.'
            )
            .setFooter({ text: 'Enderland Network • Seguridad' });

        const fila = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verificar_btn')
                .setLabel('Verificarse')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

        await message.channel.send({ embeds: [embed], components: [fila] });
        message.delete();
    }

    // OTROS COMANDOS
    if (command === 'ip') return message.reply(`📍 IP: \`${SERVER_IP}\` (Versión 1.16.x - 1.21)`);
    if (command === 'web' || command === 'tienda') return message.reply(`🛒 **Portal:** ${WEB_URL}`);
});

client.login(TOKEN);
