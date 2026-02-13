const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
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

// --- CONFIGURACIÓN SORTEOS ---
let sorteoActivo = {
    meta: null,
    premio: null,
    canalId: null
};

// --- CONFIGURACIÓN TICKETS ---
const CATEGORIA_TICKETS_ID = '1468130064217542750'; // ID de la categoría donde se crearán los tickets
const CANAL_LOGS_ID = '1468150762810114118';       // ID del canal #logs-ticket
const ROL_STAFF_ID = '1468130937681477776';        // ID del rol de Staff que puede ver los tickets

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

// --- EVENTO DE MIEMBROS (Sorteos) ---
client.on('guildMemberAdd', async (member) => {
    if (!sorteoActivo.meta) return;

    const guild = member.guild;
    const currentCount = guild.memberCount;

    if (currentCount >= sorteoActivo.meta) {
        const canal = guild.channels.cache.get(sorteoActivo.canalId);
        if (!canal) return;

        // Obtener todos los miembros (asegurarse de que estén en cache o descargarlos)
        await guild.members.fetch();
        const miembrosValidos = guild.members.cache.filter(m => !m.user.bot);
        const ganador = miembrosValidos.random();

        if (ganador) {
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎉 ¡TENEMOS UN GANADOR! 🎉')
                .setDescription(`¡Se ha alcanzado la meta de **${sorteoActivo.meta}** miembros!\n\n` +
                    `👤 **Ganador:** <@${ganador.id}>\n` +
                    `🎁 **Premio:** \`${sorteoActivo.premio}\`\n\n` +
                    `¡Felicidades! Pónte en contacto con el staff para reclamar tu premio.`)
                .setThumbnail(ganador.user.displayAvatarURL())
                .setFooter({ text: 'Enderland Network - Sorteos Automáticos' })
                .setTimestamp();

            await canal.send({ content: `🎊 ¡Felicidades <@${ganador.id}>!`, embeds: [embed] });
        }

        // Resetear sorteo
        sorteoActivo = { meta: null, premio: null, canalId: null };
    }
});

// --- MANEJO DE INTERACCIONES ---
client.on('interactionCreate', async (interaction) => {
    // 1. Manejo de Botones
    if (interaction.isButton()) {
        if (interaction.customId === 'verificar_btn') {
            try {
                // Verificar si ya tiene el rol de miembro
                if (interaction.member.roles.cache.has(ROL_MIEMBRO_ID)) {
                    return interaction.reply({ content: '✅ Ya estás verificado.', ephemeral: true });
                }

                // Intentar agregar el rol de miembro y quitar el de anti-member
                await interaction.member.roles.add(ROL_MIEMBRO_ID);
                
                // Quitar rol antimember obligatoriamente
                if (interaction.member.roles.cache.has(ROL_ANTIMEMBER_ID)) {
                    await interaction.member.roles.remove(ROL_ANTIMEMBER_ID);
                }

                await interaction.reply({ content: '🎉 ¡Bienvenido a **Enderland**! Tu acceso ha sido verificado correctamente.', ephemeral: true });
            } catch (e) {
                console.error('Error en verificación (Jerarquía de roles):', e);
                interaction.reply({ 
                    content: '❌ **Error de Jerarquía**: No pude gestionar tus roles. Asegúrate de que mi rol esté por encima de los roles que intento asignar/quitar.', 
                    ephemeral: true 
                });
            }
            return;
        }

        // Reclamar Ticket
        if (interaction.customId === 'reclamar_ticket') {
            if (!interaction.member.roles.cache.has(ROL_STAFF_ID)) {
                return interaction.reply({ content: '❌ Solo el staff puede reclamar tickets.', ephemeral: true });
            }

            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            const row = ActionRowBuilder.from(interaction.message.components[0]);
            
            // Deshabilitar botón de reclamo
            row.components[1].setDisabled(true);

            await interaction.message.edit({ components: [row] });
            await interaction.reply({ content: `👋 El staff <@${interaction.user.id}> se hará cargo de tu ticket.` });
            return;
        }

        // Abrir Modal para cerrar ticket
        if (interaction.customId === 'cerrar_ticket') {
            const modal = new ModalBuilder()
                .setCustomId('modal_cerrar_ticket')
                .setTitle('Cerrar Ticket');

            const razonInput = new TextInputBuilder()
                .setCustomId('razon_cierre')
                .setLabel('Razón de cierre')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Escribe aquí el motivo del cierre...')
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(razonInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
            return;
        }
    }

    // 2. Manejo de Select Menu (Apertura de Tickets)
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_select') {
            const tipo = interaction.values[0];
            const user = interaction.user;
            const guild = interaction.guild;

            // Verificar si ya tiene un ticket abierto
            const yaTieneTicket = guild.channels.cache.find(c => c.topic === user.id && c.parentId === CATEGORIA_TICKETS_ID);
            if (yaTieneTicket) {
                return interaction.reply({ content: `❌ Ya tienes un ticket abierto en <#${yaTieneTicket.id}>.`, ephemeral: true });
            }

            // Crear canal
            const channel = await guild.channels.create({
                name: `ticket-${user.username}`,
                type: 0, // GuildText
                parent: CATEGORIA_TICKETS_ID,
                topic: user.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    { id: ROL_STAFF_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
                ]
            });

            // Embed de bienvenida en el ticket
            const embedTicket = new EmbedBuilder()
                .setColor('#9370DB') // Morado estético
                .setTitle('『🎫』 TICKET ABIERTO')
                .setDescription(`Hola <@${user.id}>, gracias por contactar con el soporte de **Enderland**.\n\n` +
                    `**Categoría:** ${tipo.toUpperCase().replace('_', ' ')}\n` +
                    `Por favor, describe tu situación y un miembro del staff te atenderá en breve.`)
                .setFooter({ text: 'Usa los botones de abajo para gestionar el ticket.' });

            const btns = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cerrar_ticket').setLabel('🔒 Cerrar Ticket').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('reclamar_ticket').setLabel('📜 Reclamar Ticket').setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ content: `<@${user.id}> | <@&${ROL_STAFF_ID}>`, embeds: [embedTicket], components: [btns] });

            // Log de apertura
            const logChannel = guild.channels.cache.get(CANAL_LOGS_ID);
            if (logChannel) {
                const embedLog = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('📥 Ticket Abierto')
                    .addFields(
                        { name: 'Nombre', value: channel.name, inline: true },
                        { name: 'Creador', value: `<@${user.id}>`, inline: true },
                        { name: 'Tipo', value: tipo, inline: true },
                        { name: 'Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    );
                await logChannel.send({ embeds: [embedLog] });
            }

            await interaction.reply({ content: `✅ Ticket creado correctamente: <#${channel.id}>`, ephemeral: true });
        }
    }

    // 3. Manejo de Modales (Cierre de Tickets)
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_cerrar_ticket') {
            const razon = interaction.fields.getTextInputValue('razon_cierre');
            const channel = interaction.channel;
            const user = interaction.user;
            const creatorId = channel.topic;

            await interaction.reply({ content: 'Cerrando ticket...' });

            // Log de cierre
            const logChannel = interaction.guild.channels.cache.get(CANAL_LOGS_ID);
            if (logChannel) {
                const embedLog = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('📤 Ticket Cerrado')
                    .addFields(
                        { name: 'Nombre', value: channel.name, inline: true },
                        { name: 'Autor', value: `<@${creatorId}>`, inline: true },
                        { name: 'Cerrado por', value: `<@${user.id}>`, inline: true },
                        { name: 'Razón', value: razon, inline: false },
                        { name: 'Apertura', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:F>`, inline: true },
                        { name: 'Cierre', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                    );
                
                const btnLog = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('Ver Transcripción').setStyle(ButtonStyle.Link).setURL(WEB_URL) // Placeholder para transcripción
                );

                await logChannel.send({ embeds: [embedLog], components: [btnLog] });
            }

            // Borrar canal después de 5 segundos
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (e) {
                    console.error('Error al borrar el canal de ticket:', e);
                }
            }, 5000);
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
        
        if (command === 'sorteo') {
            const contenido = message.content.slice(8).split('|');
            if (contenido.length < 2) return message.reply('⚠️ Uso: `!sorteo [meta_miembros] | [premio]`');
            
            const meta = parseInt(contenido[0].trim());
            const premio = contenido[1].trim();

            if (isNaN(meta)) return message.reply('❌ La meta debe ser un número válido.');
            if (meta <= message.guild.memberCount) return message.reply(`❌ La meta debe ser superior al contador actual (**${message.guild.memberCount}**).`);

            sorteoActivo = {
                meta: meta,
                premio: premio,
                canalId: message.channel.id
            };

            const embed = new EmbedBuilder()
                .setColor('#FF4500')
                .setTitle('🎊 ¡NUEVO SORTEO POR META! 🎊')
                .setDescription(`Se ha programado un sorteo automático.\n\n` +
                    `🎯 **Meta de miembros:** \`${meta}\` miembros.\n` +
                    `🎁 **Premio:** \`${premio}\`.\n\n` +
                    `¡El ganador será elegido automáticamente al alcanzar la meta!`)
                .setFooter({ text: 'Enderland Network - Sorteos' })
                .setTimestamp();

            return message.channel.send({ embeds: [embed] });
        }

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

        if (command === 'setup-tickets') {
            const embed = new EmbedBuilder()
                .setColor('#FFD700') // Dorado/Amarillo estético
                .setTitle('『🎫』 CENTRO DE SOPORTE - ENDERLAND')
                .setDescription('¿Necesitás comprar, reclamar o reportar algo?\n\n' +
                    '🛒 **Compras**\n' +
                    '👥 **Reportes de Jugadores**\n' +
                    '🐛 **Reporte de Bugs**\n' +
                    '📩 **Otros**\n\n' +
                    'Selecciona una opción en el menú de abajo para abrir un ticket.')
                .setFooter({ text: 'Enderland Network - Sistema de Soporte' });

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_select')
                    .setPlaceholder('Despliegue el menu.')
                    .addOptions([
                        { label: 'Compras', emoji: '🛒', value: 'compras', description: 'Problemas o dudas con la tienda.' },
                        { label: 'Reportes de Jugadores', emoji: '👥', value: 'reporte_jugador', description: 'Reporta a un usuario por romper las reglas.' },
                        { label: 'Reporte de Bugs', emoji: '🐛', value: 'reporte_bug', description: 'Reporta un error técnico del servidor.' },
                        { label: 'Otros', emoji: '📩', value: 'otros', description: 'Cualquier otro tipo de consulta.' }
                    ])
            );

            await message.channel.send({ embeds: [embed], components: [menu] });
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

