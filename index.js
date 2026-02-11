const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const https = require('https');
const express = require('express');

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

const TOKEN = process.env.DISCORD_TOKEN;
const SERVER_IP = 'play.enderland.org';
const WEB_URL = 'https://enderland.org';

const MI_ID = '715742569312550933'; 
const ROL_MIEMBRO_ID = '1468135397677727870'; 
const ROL_ANTIMEMBER_ID = '1468200449466306765'; 

client.once('ready', () => {
    console.log(`✅ Enderland Bot encendido como ${client.user.tag}`);
});

// --- MANEJO DE INTERACCIONES (BOTONES Y MODALES) ---
client.on('interactionCreate', async (interaction) => {
    // 1. Lógica del Botón de Verificación
    if (interaction.isButton() && interaction.customId === 'verificar_btn') {
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

    // 2. Lógica del Modal (Envío del Embed Personalizado)
    if (interaction.isModalSubmit() && interaction.customId === 'embed_modal') {
        const titulo = interaction.fields.getTextInputValue('embed_titulo');
        const desc = interaction.fields.getTextInputValue('embed_desc');
        const color = interaction.fields.getTextInputValue('embed_color') || '#5865F2';

        const customEmbed = new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(desc)
            .setColor(color)
            .setFooter({ text: 'Enderland Network' });

        await interaction.channel.send({ embeds: [customEmbed] });
        await interaction.reply({ content: '✅ Embed enviado con éxito.', ephemeral: true });
    }
});

// --- SISTEMA DE COMANDOS ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // COMANDOS PRIVADOS (Solo Polagodd)
    const comandosAdmin = ['setup', 'msg', 'clean', 'embed'];

    if (comandosAdmin.includes(command)) {
        if (message.author.id !== MI_ID) return message.reply('❌ No tienes permiso.');

        // COMANDO EMBED CON VENTANA EMERGENTE
        if (command === 'embed') {
            const modal = new ModalBuilder()
                .setCustomId('embed_modal')
                .setTitle('Crear Embed Personalizado');

            const inputTitulo = new TextInputBuilder()
                .setCustomId('embed_titulo')
                .setLabel("Título del Embed")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const inputDesc = new TextInputBuilder()
                .setCustomId('embed_desc')
                .setLabel("Descripción / Mensaje")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const inputColor = new TextInputBuilder()
                .setCustomId('embed_color')
                .setLabel("Color Hex (Ej: #ff0000)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(inputTitulo),
                new ActionRowBuilder().addComponents(inputDesc),
                new ActionRowBuilder().addComponents(inputColor)
            );

            await message.delete();
            return interaction = await message.channel.send('⚠️ Usa comandos de barra si esto falla, o espera el modal...').then(m => {
                // En discord.js v14 para enviar un modal desde un mensaje se requiere una interacción.
                // Como !embed es un mensaje, lo ideal es usar slash commands, pero aquí te dejo la opción de msg simple:
                message.reply("Para usar el creador visual, escribe algo y presiona el botón (Próximamente mejorado con Slash Commands)");
            });
        }

        if (command === 'clean') {
            let cantidad = args[0] === 'all' ? 100 : parseInt(args[0]);
            if (isNaN(cantidad)) return message.reply('⚠️ Pon un número.');
            await message.channel.bulkDelete(cantidad, true);
            return message.channel.send(`🧹 Limpieza completada.`).then(m => setTimeout(() => m.delete(), 3000));
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
    }

    // COMANDO INFO (Público)
    if (command === 'info') {
        const infoEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('📚 Comandos de Enderland Bot')
            .addFields(
                { name: '📍 !ip', value: 'Muestra la dirección para entrar al servidor.', inline: true },
                { name: '🌍 !web', value: 'Enlace a nuestra página oficial.', inline: true },
                { name: '🛒 !tienda', value: 'Link de la tienda para rangos y unbans.', inline: true },
                { name: '🧹 !clean [n]', value: '(Admin) Borra mensajes del chat.', inline: true },
                { name: '📝 !embed', value: '(Admin) Crea un mensaje decorado.', inline: true }
            )
            .setFooter({ text: 'Enderland Network • 2026' });
        
        return message.reply({ embeds: [infoEmbed] });
    }

    if (command === 'ip') return message.reply(`📍 IP: \`${SERVER_IP}\` (1.16.x - 1.21)`);
    if (command === 'web' || command === 'tienda') return message.reply(`🌍 **Portal:** ${WEB_URL}`);
});

client.login(TOKEN);
