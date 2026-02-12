const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes } = require('discord.js');
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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// --- CONFIGURACIÓN ---
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1468079688827273257'; 
const ADMINS = ['715742569312550933', '692766059807244420']; // Polagodd y Admin Secundario
const SERVER_IP = 'play.enderland.org';
const WEB_URL = 'https://enderland.org/'; 
const DISCORD_INVITE = 'https://discord.gg/SFMFn5mDds';

const ROL_MIEMBRO_ID = '1468135397677727870'; 
const ROL_ANTIMEMBER_ID = '1468200449466306765'; 

// 1. REGISTRO DE SLASH COMMANDS
const commands = [
    { name: 'funcion', description: 'Menú visual para mensajes (Solo Admins)' },
    { name: 'discord', description: 'Enlace de invitación a la comunidad' },
    { name: 'ds', description: 'Enlace de invitación a la comunidad' },
    { name: 'web', description: 'Enlace a la web oficial' },
    { name: 'tienda', description: 'Enlace a la tienda oficial' },
    { name: 'infoserver', description: 'Estadísticas detalladas del servidor' },
    { name: 'jugadores', description: 'Ver quiénes están jugando en Enderland' }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos sincronizados correctamente.');
    } catch (e) { console.error(e); }
})();

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
    console.log(`🚀 ${client.user.tag} activo.`);
    setInterval(async () => {
        const info = await getMCStatus();
        if (info && info.online) {
            client.user.setActivity(`${info.players.online}/${info.players.max} en ${SERVER_IP}`, { type: 0 });
        }
    }, 60000);
});

// 2. MANEJO DE INTERACCIONES
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const cmd = interaction.commandName;
        
        if (['discord', 'ds'].includes(cmd)) return interaction.reply(`**Comunidad:** ${DISCORD_INVITE}`);
        if (['web', 'tienda'].includes(cmd)) return interaction.reply(`🌍 **Link Oficial:** ${WEB_URL}`);

        if (cmd === 'jugadores') {
            const info = await getMCStatus();
            if (!info || !info.online) return interaction.reply('❌ El servidor de Minecraft está offline.');
            
            const lista = info.players.list?.map(p => p.name_clean).join(', ') || 'No hay nadie conectado.';
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎮 JUGADORES ONLINE')
                .setDescription(`Actualmente hay **${info.players.online}/${info.players.max}** jugadores.\n\n**Lista:**\n\`${lista}\``)
                .setFooter({ text: `IP: ${SERVER_IP}` });
            return interaction.reply({ embeds: [embed] });
        }

        if (cmd === 'infoserver') {
            const guild = interaction.guild;
            const embed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle(`📊 ESTADÍSTICAS DE ${guild.name.toUpperCase()}`)
                .addFields(
                    { name: '👑 Dueños', value: `<@715742569312550933>\n<@692766059807244420>`, inline: true },
                    { name: '👥 Miembros', value: `**${guild.memberCount}**`, inline: true },
                    { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount}`, inline: true }
                ).setFooter({ text: `ID: ${guild.id}` });
            return interaction.reply({ embeds: [embed] });
        }

        if (cmd === 'funcion') {
            if (!ADMINS.includes(interaction.user.id)) return interaction.reply({ content: '❌ No eres admin.', ephemeral: true });
            const modal = new ModalBuilder().setCustomId('modal_funcion').setTitle('Panel Enderland');
            const t1 = new TextInputBuilder().setCustomId('titulo').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true);
            const t2 = new TextInputBuilder().setCustomId('cuerpo').setLabel("Contenido").setStyle(TextInputStyle.Paragraph).setRequired(true);
            const t3 = new TextInputBuilder().setCustomId('color').setLabel("Color Hex").setStyle(TextInputStyle.Short).setRequired(false);
            modal.addComponents(new ActionRowBuilder().addComponents(t1), new ActionRowBuilder().addComponents(t2), new ActionRowBuilder().addComponents(t3));
            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_funcion') {
        const embed = new EmbedBuilder()
            .setTitle(interaction.fields.getTextInputValue('titulo'))
            .setDescription(interaction.fields.getTextInputValue('cuerpo').replace(/\\n/g, '\n'))
            .setColor(interaction.fields.getTextInputValue('color') || '#5865F2')
            .setFooter({ text: 'Enderland Network' });
        await interaction.channel.send({ embeds: [embed] });
        await interaction.reply({ content: '✅ Enviado', ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'verificar_btn') {
        try {
            if (interaction.member.roles.cache.has(ROL_MIEMBRO_ID)) return interaction.reply({ content: '✅ Ya verificado.', ephemeral: true });
            await interaction.member.roles.add(ROL_MIEMBRO_ID);
            if (interaction.member.roles.cache.has(ROL_ANTIMEMBER_ID)) await interaction.member.roles.remove(ROL_ANTIMEMBER_ID);
            await interaction.reply({ content: '🎉 ¡Bienvenido!', ephemeral: true });
        } catch (e) { interaction.reply({ content: '❌ Error jerarquía.', ephemeral: true }); }
    }
});

// 3. COMANDOS DE TEXTO
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

    if (command === 'info') {
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('📚 MENÚ DE COMANDOS')
            .addFields(
                { name: '📍 !ip', value: 'IP del servidor.', inline: true },
                { name: '🌍 !web / !tienda', value: 'Web oficial.', inline: true },
                { name: '🎮 !jugadores', value: 'Ver quién juega.', inline: true },
                { name: '📊 /infoserver', value: 'Stats del Discord.', inline: true },
                { name: '🛡️ Admin', value: '`!clean`, `!setup`, `!texto`, `!reglas`, `/funcion`', inline: false }
            );
        return message.reply({ embeds: [embed] });
    }

    // COMANDOS DE ADMIN
    if (ADMINS.includes(message.author.id)) {
        if (command === 'clean') {
            let cant = args[0] === 'all' ? 100 : parseInt(args[0]);
            if (isNaN(cant)) return message.reply('⚠️ Uso: `!clean [n]` o `!clean all`.');
            await message.channel.bulkDelete(cant, true)
                .then(m => message.channel.send(`🧹 Se borraron **${m.size}** mensajes.`).then(msg => setTimeout(() => msg.delete(), 3000)));
            return;
        }

        if (command === 'reglas') {
            const embed = new EmbedBuilder().setColor('#e74c3c').setTitle('『📜』 REGLAS DE ENDERLAND').setDescription(`> **1. Respeto** ➜ Sin toxicidad.\n> **2. Spam** ➜ Prohibido.\n> **3. NSFW** ➜ Prohibido.\n> **4. Canales** ➜ Úsalos bien.`);
            await message.channel.send({ embeds: [embed] });
            return message.delete();
        }

        if (command === 'setup') {
            const embed = new EmbedBuilder().setColor('#5865F2').setTitle('『✅』 VERIFICACIÓN').setDescription('Haz clic abajo.');
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verificar_btn').setLabel('Verificarse').setStyle(ButtonStyle.Success).setEmoji('✅'));
            await message.channel.send({ embeds: [embed], components: [btn] });
            return message.delete();
        }

        if (command === 'texto') {
            const partes = message.content.slice(7).split('|');
            if (partes.length < 2) return message.reply('⚠️ `!texto Título | Contenido`');
            const embed = new EmbedBuilder().setTitle(partes[0].trim()).setDescription(partes[1].trim().replace(/\\n/g, '\n')).setColor(partes[2]?.trim() || '#5865F2');
            await message.channel.send({ embeds: [embed] });
            return message.delete();
        }
    }
});

client.login(TOKEN);
