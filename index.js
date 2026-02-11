const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const https = require('https');
const express = require('express');

// --- SERVIDOR WEB ---
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Enderland Bot Online'));
app.listen(port);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// --- CONFIGURACIÓN ---
const TOKEN = process.env.DISCORD_TOKEN;
const SERVER_IP = 'play.enderland.org';
const WEB_URL = 'https://enderland.org';

const MI_ID = '715742569312550933'; 
const ROL_MIEMBRO_ID = '1468135397677727870'; 
const ROL_ANTIMEMBER_ID = '1468200449466306765'; 

client.once('ready', () => {
    console.log(`✅ Enderland Bot encendido como ${client.user.tag}`);
});

// --- LÓGICA DE VERIFICACIÓN (BOTONES) ---
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
            await interaction.reply({ content: '❌ Error de jerarquía.', ephemeral: true });
        }
    }
});

// --- SISTEMA DE COMANDOS ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // COMANDOS PRIVADOS (Solo Polagodd)
    const comandosAdmin = ['setup', 'msg', 'clean'];

    if (comandosAdmin.includes(command)) {
        if (message.author.id !== MI_ID) return message.reply('❌ No tienes permiso.');

        // COMANDO CLEAN (¡NUEVO!)
        if (command === 'clean') {
            let cantidad = args[0];

            if (!cantidad) return message.reply('⚠️ Uso: `!clean [número]` o `!clean all`');

            if (cantidad.toLowerCase() === 'all') {
                cantidad = 100; // Discord limita el borrado masivo a 100 por vez
            } else {
                cantidad = parseInt(cantidad);
                if (isNaN(cantidad) || cantidad <= 0 || cantidad > 100) {
                    return message.reply('⚠️ Pon un número entre 1 y 100.');
                }
            }

            // Borrar mensajes
            await message.channel.bulkDelete(cantidad, true)
                .then(m => message.channel.send(`🧹 Se han borrado **${m.size}** mensajes.`).then(msg => setTimeout(() => msg.delete(), 3000)))
                .catch(() => message.reply('❌ Solo puedo borrar mensajes de menos de 14 días.'));
            return;
        }

        if (command === 'setup') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('『✅』 SISTEMA DE VERIFICACIÓN')
                .setDescription('¡Bienvenido a **Enderland Network**!\n\nHaz clic abajo para acceder.');

            const fila = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('verificar_btn').setLabel('Verificarse').setStyle(ButtonStyle.Success).setEmoji('✅')
            );

            await message.channel.send({ embeds: [embed], components: [fila] });
            return message.delete();
        }

        if (command === 'msg') {
            const canal = message.mentions.channels.first();
            const texto = args.slice(1).join(' ');
            if (!canal || !texto) return message.reply('⚠️ Uso: `!msg #canal texto`');
            canal.send(texto);
            return message.delete();
        }
    }

    // COMANDOS PÚBLICOS
    if (command === 'ip') {
        // Solo responde esto y nada más
        return message.reply(`📍 IP: \`${SERVER_IP}\` (1.16.x - 1.21)`);
    }
    
    if (command === 'web') return message.reply(`🌍 **Portal:** ${WEB_URL}`);
});

client.login(TOKEN);
