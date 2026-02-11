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
        GatewayIntentBits.GuildMembers
    ]
});

// --- CONFIGURACIÓN ---
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1468079688827273257'; 
const MI_ID = '715742569312550933'; 
const SERVER_IP = 'play.enderland.org';
const WEB_URL = 'https://enderland.org';

// IDs DE ROLES
const ROL_MIEMBRO_ID = '1468135397677727870'; 
const ROL_ANTIMEMBER_ID = '1468200449466306765'; 

// 1. REGISTRO DE SLASH COMMANDS
const commands = [
    {
        name: 'funcion',
        description: 'Abre el menú para crear un mensaje decorado (Solo Polagodd)',
    },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Registrando Slash Commands...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comando /funcion registrado.');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', () => {
    console.log(`🚀 ${client.user.tag} activo.`);
    
    // Estado de Minecraft
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

// 2. MANEJO DE INTERACCIONES (BOTONES Y SLASH)
client.on('interactionCreate', async (interaction) => {
    
    // Comando /funcion (Abre el Modal)
    if (interaction.isChatInputCommand() && interaction.commandName === 'funcion') {
        if (interaction.user.id !== MI_ID) return interaction.reply({ content: '❌ Sin permiso.', ephemeral: true });

        const modal = new ModalBuilder().setCustomId('modal_funcion').setTitle('Creador de Mensajes');
        
        const inputTitulo = new TextInputBuilder().setCustomId('titulo').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true);
        const inputCuerpo = new TextInputBuilder().setCustomId('cuerpo').setLabel("Contenido").setStyle(TextInputStyle.Paragraph).setRequired(true);
        const inputColor = new TextInputBuilder().setCustomId('color').setLabel("Color Hex").setStyle(TextInputStyle.Short).setPlaceholder("#5865F2").setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(inputTitulo),
            new ActionRowBuilder().addComponents(inputCuerpo),
            new ActionRowBuilder().addComponents(inputColor)
        );
        await interaction.showModal(modal);
    }

    // Respuesta del Modal
    if (interaction.isModalSubmit() && interaction.customId === 'modal_funcion') {
        const titulo = interaction.fields.getTextInputValue('titulo');
        const cuerpo = interaction.fields.getTextInputValue('cuerpo');
        const color = interaction.fields.getTextInputValue('color') || '#5865F2';

        const embed = new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(cuerpo.replace(/\\n/g, '\n')) // Soporte para saltos de línea
            .setColor(color.startsWith('#') ? color : '#5865F2')
            .setFooter({ text: 'Enderland Network', iconURL: client.user.displayAvatarURL() });

        await interaction.channel.send({ embeds: [embed] });
        await interaction.reply({ content: '✅ Mensaje enviado.', ephemeral: true });
    }

    // Botón de Verificación
    if (interaction.isButton() && interaction.customId === 'verificar_btn') {
        const miembro = interaction.member;
        try {
            if (miembro.roles.cache.has(ROL_MIEMBRO_ID)) return interaction.reply({ content: '✅ Ya estás verificado.', ephemeral: true });
            
            await miembro.roles.add(ROL_MIEMBRO_ID);
            if (miembro.roles.cache.has(ROL_ANTIMEMBER_ID)) await miembro.roles.remove(ROL_ANTIMEMBER_ID);
            
            await interaction.reply({ content: '🎉 ¡Bienvenido a **Enderland**!', ephemeral: true });
        } catch (e) {
            interaction.reply({ content: '❌ Error de jerarquía.', ephemeral: true });
        }
    }
});

// 3. COMANDOS DE TEXTO (!clean, !setup, !ip, !info)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Privados
    if (['setup', 'clean', 'msg'].includes(command) && message.author.id === MI_ID) {
        if (command === 'setup') {
            const embed = new EmbedBuilder().setColor('#5865F2').setTitle('『✅』 VERIFICACIÓN').setDescription('Haz clic abajo.');
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verificar_btn').setLabel('Verificarse').setStyle(ButtonStyle.Success).setEmoji('✅'));
            await message.channel.send({ embeds: [embed], components: [btn] });
            return message.delete();
        }

        if (command === 'clean') {
            let cant = args[0] === 'all' ? 100 : parseInt(args[0]);
            if (isNaN(cant)) return message.reply('⚠️ Pon un número.');
            await message.channel.bulkDelete(cant, true);
            return message.channel.send('🧹 Limpieza lista.').then(m => setTimeout(() => m.delete(), 3000));
        }
    }

    // Públicos
    if (command === 'ip') return message.reply(`📍 IP: \`${SERVER_IP}\` (1.16.x - 1.21)`);
    if (command === 'info') {
        const embed = new EmbedBuilder().setColor('#2ecc71').setTitle('📚 Comandos').addFields(
            { name: '!ip', value: 'IP del server.', inline: true },
            { name: '/funcion', value: 'Crear embed (Admin).', inline: true },
            { name: '!clean', value: 'Borrar chat (Admin).', inline: true }
        );
        return message.reply({ embeds: [embed] });
    }
});

client.login(TOKEN);
