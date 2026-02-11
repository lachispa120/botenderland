const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes } = require('discord.js');
const express = require('express');

// --- SERVIDOR WEB ---
const app = express();
app.get('/', (req, res) => res.send('✅ Enderland Bot Online'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

// --- CONFIGURACIÓN ---
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1468079688827273257'; // <--- PEGA EL ID DE TU BOT AQUÍ
const MI_ID = '715742569312550933'; 

// 1. REGISTRO DEL COMANDO /texto EN DISCORD
const commands = [
    {
        name: 'texto',
        description: 'Abre el menú para crear un mensaje decorado (Solo Polagodd)',
    },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Registrando Slash Commands...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Slash Commands listos.');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', () => console.log(`🚀 ${client.user.tag} activo.`));

// 2. MANEJO DE INTERACCIONES
client.on('interactionCreate', async (interaction) => {
    
    // Si usas el comando /texto
    if (interaction.isChatInputCommand() && interaction.commandName === 'texto') {
        if (interaction.user.id !== MI_ID) {
            return interaction.reply({ content: '❌ No tienes permiso.', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId('modal_texto')
            .setTitle('Creador de Mensajes Enderland');

        const inputTitulo = new TextInputBuilder()
            .setCustomId('titulo')
            .setLabel("Título del mensaje")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ej: ⭐ | REGLAS DEL SERVIDOR")
            .setRequired(true);

        const inputCuerpo = new TextInputBuilder()
            .setCustomId('cuerpo')
            .setLabel("Contenido del mensaje")
            .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("> Regla 1 ➜ ...\n> Regla 2 ➜ ...")
            .setRequired(true);

        const inputColor = new TextInputBuilder()
            .setCustomId('color')
            .setLabel("Color Hex (Ej: #5865F2)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(inputTitulo),
            new ActionRowBuilder().addComponents(inputCuerpo),
            new ActionRowBuilder().addComponents(inputColor)
        );

        await interaction.showModal(modal);
    }

    // Si envías el formulario del Modal
    if (interaction.isModalSubmit() && interaction.customId === 'modal_texto') {
        const titulo = interaction.fields.getTextInputValue('titulo');
        const cuerpo = interaction.fields.getTextInputValue('cuerpo');
        const color = interaction.fields.getTextInputValue('color') || '#5865F2';

        const embed = new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(cuerpo)
            .setColor(color.startsWith('#') ? color : '#5865F2')
            .setFooter({ text: 'Enderland Network', iconURL: client.user.displayAvatarURL() });

        await interaction.channel.send({ embeds: [embed] });
        await interaction.reply({ content: '✅ Mensaje enviado.', ephemeral: true });
    }
});

client.login(TOKEN);
