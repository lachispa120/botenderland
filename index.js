require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const firebase = require('firebase/compat/app');
require('firebase/compat/database');
const express = require('express'); 
const cors = require('cors'); 

// --- 1. CONFIGURACIÓN DE EXPRESS (PROXY Y SALUD) ---
const appExpress = express(); 
appExpress.use(cors());
appExpress.use(express.json());

// Ruta principal para que Render vea que el sitio carga (GET /)
appExpress.get('/', (req, res) => {
    res.send('<h1>🚀 EnderBot Proxy Online</h1><p>El servidor está funcionando correctamente.</p>');
});

// Ruta de ayuda para el proxy (GET /chat-proxy)
appExpress.get('/chat-proxy', (req, res) => {
    res.send('Ruta lista. Envía peticiones POST desde la web para hablar con la IA.');
});

// Proxy para el Chatbot (POST /chat-proxy)
appExpress.post('/chat-proxy', async (req, res) => {
    try {
        const { model, messages } = req.body;
        console.log("📩 Mensaje recibido de la web...");

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model || "llama3-8b-8192",
                messages: messages 
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("❌ Error de Groq:", data.error);
            return res.status(500).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error("❌ Error Crítico Proxy:", error);
        res.status(500).json({ error: "Error en el túnel de la API", details: error.message });
    }
});

const PORT = process.env.PORT || 10000;
appExpress.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API del Chatbot lista y escuchando en puerto ${PORT}`);
});

// --- 2. CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: "enderland-7c875.firebaseapp.com",
    databaseURL: "https://enderland-7c875-default-rtdb.firebaseio.com",
    projectId: "enderland-7c875",
    storageBucket: "enderland-7c875.firebasestorage.app",
    messagingSenderId: "90498636412",
    appId: "1:90498636412:web:41081a7ff3693104bb87f9"
};

const fbApp = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- 3. DISCORD BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers 
    ]
});

const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID;

client.once('ready', () => {
    console.log(`\n=========================================`);
    console.log(`✅ BOT ONLINE: ${client.user.tag}`);
    console.log(`=========================================\n`);
    listenForOrders();
});

function listenForOrders() {
    console.log("📡 [SISTEMA] Escuchando compras en tiempo real...");
    const ordersRef = db.ref('recent_purchases');
    
    ordersRef.on('child_added', async (snapshot) => {
        const order = snapshot.val();
        const orderId = snapshot.key;
        if (!order || order.ticketId || order.status === 'ticket_created') return;
        const diff = Date.now() - (order.createdAt || 0);
        if (diff > 3600000) return; 
        console.log(`\n🛒 [NUEVA COMPRA] ID: ${orderId} | MC: ${order.user}`);
        await createTicket(order, orderId);
    });
}

async function createTicket(order, orderId) {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) return console.error("❌ [ERROR] No se encontró el Servidor (Guild)");

        let member = null;
        const searchKey = (order.discord || "").trim();

        if (searchKey) {
            try {
                if (searchKey.match(/^\d{17,20}$/)) {
                    member = await guild.members.fetch(searchKey).catch(() => null);
                }
                if (!member) {
                    const membersFound = await guild.members.fetch({ query: searchKey, limit: 1 });
                    member = membersFound.first();
                }
            } catch (e) { 
                console.log("⚠️ [ADVERTENCIA] Error durante la búsqueda de usuario."); 
            }
        }

        const permissionOverwrites = [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
        ];

        if (SUPPORT_ROLE_ID) {
            permissionOverwrites.push({ id: SUPPORT_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
        }
        if (member) {
            permissionOverwrites.push({ id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
        }

        const sanitizedUser = (order.user || "unknown").replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 10);
        const channel = await guild.channels.create({
            name: `compra-${sanitizedUser}-${orderId.slice(-4)}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID || null,
            permissionOverwrites: permissionOverwrites
        });

        const itemsList = (order.items || []).map(i => {
            const precio = i.finalPrice || i.basePrice || 0; 
            return `\`$${parseFloat(precio).toFixed(2).padEnd(8)}\` | **${i.name}**`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`🛒 RESUMEN DE COMPRA`)
            .setColor(member ? 0x2ECC71 : 0xE67E22)
            .addFields(
                { name: '👤 Cliente', value: `> **MC:** \`${order.user}\` \n> **Discord:** ${member ? `<@${member.id}>` : `\`${searchKey}\``}`, inline: false },
                { name: '📦 Productos', value: itemsList || 'Sin items', inline: false },
                { name: '💰 Pago', value: `\`\`\`yaml\nTotal: $${(order.totalFinal || 0).toFixed(2)} USD\n\`\`\``, inline: false }
            );

        await channel.send({ content: member ? `### 👋 ¡Hola <@${member.id}>!` : `### ⚠️ Atención Staff`, embeds: [embed] });
        await db.ref(`recent_purchases/${orderId}`).update({ ticketId: channel.id, status: 'ticket_created' });

    } catch (error) {
        console.error("❌ [ERROR CRÍTICO] Ticket:", error);
    }
}

client.login(process.env.DISCORD_TOKEN);
