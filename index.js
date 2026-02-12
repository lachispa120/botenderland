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
const ADMINS = ['715742569312550933', '692766059807244420']; // Polagodd y nuevo admin
const SERVER_IP = 'play.enderland.org';
const WEB_URL = 'https://enderland.org';
const DISCORD_INVITE = 'https://discord.gg/SFMFn5mDds';

const ROL_MIEMBRO_ID = '1468135397677727870'; 
const ROL_ANTIMEMBER_ID = '1468200449466306765'; 

// 1. REGISTRO DE SLASH COMMANDS
const commands = [
    { name: 'funcion', description: 'Menú visual para mensajes (Solo Admins)' },
    { name: 'discord', description: 'Enlace de invitación a la comunidad' },
    { name: 'ds', description: 'Enlace de invitación a la comunidad' }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos de barra listos.');
    } catch (e) { console.error(e); }
})();

client.once('ready', () => {
    console.log(`🚀 ${client.user.tag} activo.`);
    setInterval(() => {
        https.get(`https://api.mcstatus.io/v2/status/java/${SERVER_IP}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const info = JSON.parse(data);
                    if (info.online) client.user.setActivity(`${info.players.online}/${info.players.max} en ${SERVER_IP}`, { type: 0 });
                } catch (e) { }
            });
        });
    }, 60000);
});

// 2. MANEJO DE INTERACCIONES
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (['discord', 'ds'].includes(interaction.commandName)) {
            return interaction.reply(`**Comunidad:** ${DISCORD_INVITE}`);
        }

        if (interaction.commandName === 'funcion') {
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

    // Comandos de Invitación
    if (['ds', 'discord'].includes(command)) {
        return message.reply(`**Comunidad:** ${DISCORD_INVITE}`);
    }

    // Info Server
    if (command === 'infoserver') {
        const guild = message.guild;
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle(`📊 Información de ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: '👥 Miembros Totales', value: `${guild.memberCount}`, inline: true },
                { name: '📅 Creación', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                { name: '👑 Dueño', value: `<@${guild.ownerId}>`, inline: true },
                { name: '🚀 Mejoras', value: `${guild.premiumSubscriptionCount || 0} Boosts`, inline: true }
            )
            .setFooter({ text: `ID: ${guild.id}` });
        return message.reply({ embeds: [embed] });
    }

    // COMANDOS DE ADMIN
    if (ADMINS.includes(message.author.id)) {
        
        if (command === 'reglas') {
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('『📜』 REGLAS DE ENDERLAND')
                .setDescription(
                    `ㅤ\n` +
                    `> **1. Respeto** ➜ No se tolera toxicidad ni discriminación.\n` +
                    `> **2. Spam** ➜ Prohibido enviar invitaciones o flood.\n` +
                    `> **3. Contenido** ➜ No se permite material NSFW o ilegal.\n` +
                    `> **4. Canales** ➜ Usa cada canal para su propósito específico.\n` +
                    `> **5. Sanciones** ➜ El staff tiene la última palabra.\n\n` +
                    `Sigue las guías de Discord ➜ <https://discord.com/terms>`
                )
                .setFooter({ text: 'Enderland Network • Seguridad', iconURL: client.user.displayAvatarURL() });
            await message.channel.send({ embeds: [embed] });
            return message.delete();
        }

        if (command === 'texto') {
            const partes = message.content.slice(7).split('|');
            if (partes.length < 2) return message.reply('⚠️ `!texto Titulo | Desc | Color`');
            const embed = new EmbedBuilder().setTitle(partes[0].trim()).setDescription(partes[1].trim().replace(/\\n/g, '\n')).setColor(partes[2]?.trim() || '#5865F2');
            await message.channel.send({ embeds: [embed] });
            return message.delete();
        }

        if (command === 'clean') {
            let cant = args[0] === 'all' ? 100 : parseInt(args[0]);
            if (isNaN(cant)) return message.reply('⚠️ Pon un número.');
            await message.channel.bulkDelete(cant, true);
            return message.channel.send('🧹 Limpio.').then(m => setTimeout(() => m.delete(), 3000));
        }

        if (command === 'setup') {
            const embed = new EmbedBuilder().setColor('#5865F2').setTitle('『✅』 VERIFICACIÓN').setDescription('Haz clic abajo para entrar.');
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verificar_btn').setLabel('Verificarse').setStyle(ButtonStyle.Success).setEmoji('✅'));
            await message.channel.send({ embeds: [embed], components: [btn] });
            return message.delete();
        }
    }

    // Otros Públicos
    if (command === 'ip') return message.reply(`📍 IP: \`${SERVER_IP}\` (1.16.x - 1.21)`);
    if (command === 'info') {
        const embed = new EmbedBuilder().setColor('#2ecc71').setTitle('📚 Comandos').addFields(
            { name: '!ip', value: 'IP Server.', inline: true },
            { name: '!ds', value: 'Invitación.', inline: true },
            { name: '!infoserver', value: 'Datos del Discord.', inline: true },
            { name: '!reglas', value: 'Enviar reglas (Admin).', inline: true }
        );
        return message.reply({ embeds: [embed] });
    }
});

client.login(TOKEN);
