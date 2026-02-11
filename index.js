const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const https = require('https');
const express = require('express');

// --- SERVIDOR WEB PARA MANTENER EL BOT ACTIVO ---
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Enderland Bot está funcionando 24/7'));
app.listen(port, () => console.log(`📡 Servidor activo en puerto ${port}`));

// --- CONFIGURACIÓN DEL CLIENTE ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// --- VARIABLES DE CONFIGURACIÓN ---
const TOKEN = process.env.DISCORD_TOKEN;
const SERVER_IP = 'play.enderland.org';
const WEB_URL = 'https://enderland.org';

// ⚠️ TUS IDs (Verifica que sean los correctos)
const MI_ID = '715742569312550933'; 
const ROL_MIEMBRO_ID = '1468135397677727870'; 
const ROL_ANTIMEMBER_ID = '1468200449466306765'; 

client.once('ready', () => {
    console.log(`✅ Enderland Bot encendido como ${client.user.tag}`);
    
    // Estado dinámico con jugadores de Minecraft
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
                } catch (e) { }
            });
        });
    }, 60000);
});

// --- SISTEMA DE VERIFICACIÓN (BOTONES) ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'verificar_btn') {
        const miembro = interaction.member;
        try {
            if (miembro.roles.cache.has(ROL_MIEMBRO_ID)) {
                return interaction.reply({ content: '✅ Ya estás verificado.', ephemeral: true });
            }

            await miembro.roles.add(ROL_MIEMBRO_ID);
            if (miembro.roles.cache.has(ROL_ANTIMEMBER_ID)) {
                await miembro.roles.remove(ROL_ANTIMEMBER_ID);
            }

            await interaction.reply({ content: '🎉 ¡Bienvenido a **Enderland**!', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Error de jerarquía. Sube mi rol arriba de los demás.', ephemeral: true });
        }
    }
});

// --- SISTEMA DE COMANDOS ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 🔒 COMANDOS PRIVADOS (Solo Polagodd)
    const comandosAdmin = ['setup', 'msg', 'clean', 'texto'];

    if (comandosAdmin.includes(command)) {
        if (message.author.id !== MI_ID) {
            return message.reply('❌ No tienes permiso para usar comandos de administrador.');
        }

        // COMANDO !texto (Anteriormente embed)
        if (command === 'texto') {
            const contenido = message.content.slice(7); // Quita "!texto "
            const partes = contenido.split('|');

            if (partes.length < 2) {
                return message.reply('⚠️ **Uso:** `!texto Titulo | Descripción | ColorHex`');
            }

            const titulo = partes[0].trim();
            const desc = partes[1].trim();
            const color = partes[2] ? partes[2].trim() : '#5865F2';

            const customEmbed = new EmbedBuilder()
                .setTitle(titulo)
                .setDescription(desc)
                .setColor(color.startsWith('#') ? color : '#5865F2')
                .setFooter({ text: 'Enderland Network', iconURL: client.user.displayAvatarURL() });

            await message.channel.send({ embeds: [customEmbed] });
            return message.delete();
        }

        // COMANDO !clean
        if (command === 'clean') {
            let cantidad = args[0] === 'all' ? 100 : parseInt(args[0]);
            if (isNaN(cantidad)) return message.reply('⚠️ Pon un número o "all".');

            try {
                await message.channel.bulkDelete(cantidad, true);
                const msg = await message.channel.send(`🧹 Se han borrado los mensajes.`);
                setTimeout(() => msg.delete(), 3000);
            } catch (e) {
                message.reply('❌ Solo puedo borrar mensajes recientes (menos de 14 días).');
            }
            return;
        }

        // COMANDO !setup
        if (command === 'setup') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('『✅』 SISTEMA DE VERIFICACIÓN')
                .setDescription('Bienvenido a **Enderland Network**. Haz clic abajo para entrar.');

            const fila = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('verificar_btn').setLabel('Verificarse').setStyle(ButtonStyle.Success).setEmoji('✅')
            );

            await message.channel.send({ embeds: [embed], components: [fila] });
            return message.delete();
        }

        // COMANDO !msg
        if (command === 'msg') {
            const canal = message.mentions.channels.first();
            const texto = args.slice(1).join(' ');
            if (!canal || !texto) return message.reply('⚠️ Uso: `!msg #canal texto`');
            canal.send(texto);
            return message.delete();
        }
    }

    // 📢 COMANDOS PÚBLICOS
    if (command === 'info') {
        const infoEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('📚 Enderland Bot - Información')
            .addFields(
                { name: '📍 !ip', value: 'Dirección del servidor.', inline: true },
                { name: '🌍 !web', value: 'Link de la web.', inline: true },
                { name: '🛒 !tienda', value: 'Tienda oficial.', inline: true },
                { name: '🧹 !clean [n]', value: '(Admin) Borrar chat.', inline: true },
                { name: '📝 !texto [T|D|C]', value: '(Admin) Crear mensaje decorado.', inline: false }
            );
        return message.reply({ embeds: [infoEmbed] });
    }

    if (command === 'ip') return message.reply(`📍 IP: \`${SERVER_IP}\` (1.16.x - 1.21)`);
    if (command === 'web' || command === 'tienda') return message.reply(`🌍 **Portal:** ${WEB_URL}`);
});

client.login(TOKEN);
