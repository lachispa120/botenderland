const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const https = require('https');
const express = require('express');

// --- SERVIDOR WEB ---
const app = express();
app.get('/', (req, res) => res.send('✅ Enderland Bot Online'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// --- CONFIGURACIÓN ---
const TOKEN = process.env.DISCORD_TOKEN;
const ADMINS = ['715742569312550933', '692766059807244420']; 
const SERVER_IP = 'play.enderland.org';
const WEB_URL = 'https://enderland.org/'; 
const DISCORD_INVITE = 'https://discord.gg/SFMFn5mDds';

const ROL_MIEMBRO_ID = '1468135397677727870'; 
const ROL_ANTIMEMBER_ID = '1468200449466306765'; 

// Función para consultar MCSTATUS
async function getMCStatus() {
    return new Promise((resolve) => {
        https.get(`https://api.mcstatus.io/v2/status/java/${SERVER_IP}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

client.once('ready', () => {
    console.log(`🚀 ${client.user.tag} activo sin Slash Commands.`);
    setInterval(async () => {
        const info = await getMCStatus();
        if (info && info.online) {
            client.user.setActivity(`${info.players.online}/${info.players.max} en ${SERVER_IP}`, { type: 0 });
        }
    }, 60000);
});

// --- MANEJO DE INTERACCIONES (Solo Botones) ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'verificar_btn') {
        try {
            if (interaction.member.roles.cache.has(ROL_MIEMBRO_ID)) return interaction.reply({ content: '✅ Ya estás verificado.', ephemeral: true });
            await interaction.member.roles.add(ROL_MIEMBRO_ID);
            if (interaction.member.roles.cache.has(ROL_ANTIMEMBER_ID)) await interaction.member.roles.remove(ROL_ANTIMEMBER_ID);
            await interaction.reply({ content: '🎉 ¡Bienvenido a **Enderland**!', ephemeral: true });
        } catch (e) {
            interaction.reply({ content: '❌ Error de jerarquía. Pon mi rol arriba de todos.', ephemeral: true });
        }
    }
});

// --- TODOS LOS COMANDOS CON ! ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // COMANDOS PÚBLICOS
    if (command === 'ip') return message.reply(`📍 IP: \`${SERVER_IP}\` (1.16.x - 1.21)`);
    if (['web', 'tienda'].includes(command)) return message.reply(`🌍 **Link Oficial:** ${WEB_URL}`);
    if (['ds', 'discord'].includes(command)) return message.reply(`**Comunidad:** ${DISCORD_INVITE}`);
    
    if (command === 'jugadores') {
        const info = await getMCStatus();
        if (!info || !info.online) return message.reply('❌ El servidor está offline.');
        const lista = info.players.list?.map(p => p.name_clean).join(', ') || 'No hay nadie conectado.';
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎮 JUGADORES ONLINE').setDescription(`Online: **${info.players.online}/${info.players.max}**\n\n**Lista:**\n\`${lista}\``);
        return message.reply({ embeds: [embed] });
    }

    if (command === 'infoserver') {
        const guild = message.guild;
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle(`📊 ESTADÍSTICAS DE ${guild.name.toUpperCase()}`)
            .addFields(
                { name: '👑 Dueños', value: `<@715742569312550933>\n<@692766059807244420>`, inline: true },
                { name: '👥 Miembros', value: `**${guild.memberCount}**`, inline: true },
                { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount}`, inline: true },
                { name: '📅 Creado', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true }
            );
        return message.reply({ embeds: [embed] });
    }

    if (command === 'info') {
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('📚 MENÚ DE COMANDOS')
            .addFields(
                { name: '📍 !ip', value: 'IP del servidor.', inline: true },
                { name: '🌍 !web / !tienda', value: 'Web oficial.', inline: true },
                { name: '🎮 !jugadores', value: 'Ver quién juega.', inline: true },
                { name: '📊 !infoserver', value: 'Stats del Discord.', inline: true },
                { name: '💬 !ds / !discord', value: 'Invitación.', inline: true },
                { name: '🛡️ Admin', value: '`!clean [n/all]`, `!setup`, `!texto [T|D|C]`, `!reglas`, `!msg #canal texto`', inline: false }
            );
        return message.reply({ embeds: [embed] });
    }

    // COMANDOS DE ADMIN
    if (ADMINS.includes(message.author.id)) {
        
        if (command === 'clean') {
            let cant = args[0] === 'all' ? 100 : parseInt(args[0]);
            if (isNaN(cant) || cant <= 0) return message.reply('⚠️ Uso: `!clean [n]` o `!clean all`.');
            await message.channel.bulkDelete(cant, true)
                .then(m => message.channel.send(`🧹 Se borraron **${m.size}** mensajes.`).then(msg => setTimeout(() => msg.delete(), 3000)))
                .catch(() => message.reply('❌ No puedo borrar mensajes de más de 14 días.'));
            return;
        }

        if (command === 'reglas') {
            const embed = new EmbedBuilder().setColor('#e74c3c').setTitle('『📜』 REGLAS DE ENDERLAND').setDescription(`> **1. Respeto** ➜ Sin toxicidad.\n> **2. Spam** ➜ Prohibido.\n> **3. NSFW** ➜ Prohibido.\n> **4. Canales** ➜ Úsalos bien.`);
            await message.channel.send({ embeds: [embed] });
            return message.delete();
        }

        if (command === 'setup') {
            const embed = new EmbedBuilder().setColor('#5865F2').setTitle('『✅』 VERIFICACIÓN').setDescription('Haz clic abajo para entrar.');
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verificar_btn').setLabel('Verificarse').setStyle(ButtonStyle.Success).setEmoji('✅'));
            await message.channel.send({ embeds: [embed], components: [btn] });
            return message.delete();
        }

        if (command === 'texto') {
            const partes = message.content.slice(7).split('|');
            if (partes.length < 2) return message.reply('⚠️ `!texto Título | Contenido | #Color`');
            const embed = new EmbedBuilder().setTitle(partes[0].trim()).setDescription(partes[1].trim().replace(/\\n/g, '\n')).setColor(partes[2]?.trim() || '#5865F2').setFooter({ text: 'Enderland Network' });
            await message.channel.send({ embeds: [embed] });
            return message.delete();
        }

        if (command === 'msg') {
            const canal = message.mentions.channels.first();
            const texto = args.slice(1).join(' ');
            if (canal && texto) canal.send(texto);
            return message.delete();
        }
    }
});

client.login(TOKEN);
