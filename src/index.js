const dotenv = require('dotenv')
dotenv.config()

const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, EmbedBuilder, OverwriteType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const express = require('express')

const BOT_TOKEN = process.env.BOT_TOKEN
const GUILD_ID = process.env.GUILD_ID
const CATEGORY_ID = process.env.CATEGORY_ID
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID
const STAFF_ROLE_IDS = process.env.STAFF_ROLE_IDS ? String(process.env.STAFF_ROLE_IDS).split(',').map((s) => s.trim()).filter(Boolean) : (STAFF_ROLE_ID ? [STAFF_ROLE_ID] : [])
const PORT = Number(process.env.PORT || 3000)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
})

const app = express()
const lastEvents = []
const ticketStatus = new Map()
function pushEvent(event, data) {
  try {
    lastEvents.push({ ts: Date.now(), event, data })
    if (lastEvents.length > 50) lastEvents.shift()
  } catch (_) {}
}
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json())

app.get('/health', (_, res) => {
  res.json({ ok: true })
})
app.get('/debug/events', (_, res) => {
  res.json({ ok: true, events: lastEvents })
})
app.get('/webhook/pedido/status', (req, res) => {
  try {
    const orderId = String(req.query.orderId || '').trim()
    if (!orderId) return res.status(400).json({ ok: false, error: 'missing_order_id' })
    const s = ticketStatus.get(orderId)
    if (!s) return res.status(404).json({ ok: false })
    const url = s.url || `https://discord.com/channels/${s.guildId}/${s.channelId}`
    return res.json({ ok: true, orderId, channelId: s.channelId, url })
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'internal_error' })
  }
})

app.get('/autoticket.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript')
  res.send(`(function(){function i(){var m=document.getElementById('cart-modal');if(!m)return;var c=m.querySelector('.modal-content');if(!c)return;if(document.getElementById('discord-id-input'))return;var d=document.createElement('div');d.className='coupon-section';d.style.cssText='margin-top:15px; padding-top:10px; border-top:1px solid #333;';d.innerHTML='<label style="font-size:0.9rem; color:#ccc;">Discord ID (numérico)</label>'+'<input type="text" id="discord-id-input" class="admin-input" placeholder="Ej: 123456789012345678" inputmode="numeric" pattern="[0-9]{15,25}">'+'<div id="discord-id-help" style="font-size:0.8rem; color:#888; margin-top:4px;">Activa Modo desarrollador en Discord → Copiar ID.</div>';var t=c.querySelector('span#cart-total-price'),b=t?t.parentElement.parentElement:null;c.insertBefore(d,b||c.lastChild)}function v(){if(typeof window.checkout!=='function')return;if(window._patchedCheckout)return;window._origCheckout=window.checkout;window.checkout=async function(){var x=document.getElementById('discord-id-input');var s=String((x&&x.value)||'').trim();var ok=/^\\d{15,25}$/.test(s);if(!ok){alert('Por favor, pega tu Discord ID numérico (15–25 dígitos). Activa Modo desarrollador en Discord → Copiar ID.');return}window._discordUserId=s;return window._origCheckout()};window._patchedCheckout=true}function w(){if(typeof window.sendDiscordWebhook!=='function')return;if(window._patchedSendWebhook)return;var o=window.sendDiscordWebhook;window._origSendDiscordWebhook=o;window.sendDiscordWebhook=async function(order){try{await o(order)}finally{try{var id=String(window._discordUserId||'').trim();var product=(order&&order.items&&order.items[0]&&order.items[0].name)||'Pedido';var orderId=String(order&&(order.id||order.createdAt||Date.now()));if(!/^\\d{15,25}$/.test(id))return;var a=new AbortController();var t=setTimeout(function(){try{a.abort()}catch(e){}},5000);await fetch('http://localhost:3000/webhook/pedido',{method:'POST',headers:{'Content-Type':'application/json','X-Webhook-Secret':'reymisterio'},body:JSON.stringify({discordUserId:id,orderId:orderId,product:product}),signal:a.signal}).catch(function(){});try{clearTimeout(t)}catch(e){}}catch(e){}};window._patchedSendWebhook=true}function init(){i();v();w()}document.addEventListener('DOMContentLoaded',init);var oc=window.openCart;window.openCart=function(){if(typeof oc==='function')oc();i()};})();`)
})

function extractUserId(discordUserId, discordUser) {
  const id = String(discordUserId || '').trim()
  if (/^\d{15,25}$/.test(id)) return id
  const raw = String(discordUser || '').trim()
  if (!raw) return null
  const mentionMatch = raw.match(/<@!?(\d{15,25})>/)
  if (mentionMatch) return mentionMatch[1]
  const digits = raw.match(/(\d{15,25})/)
  if (digits) return digits[1]
  return null
}
async function findMemberByName(guild, name) {
  if (!guild || !name) return null
  const q = String(name).trim().replace(/^@+/, '').toLowerCase()
  let m = guild.members.cache.find((mm) => {
    const u = mm.user
    return (u && u.username && u.username.toLowerCase() === q) || (mm.displayName && mm.displayName.toLowerCase() === q)
  })
  if (m) return m
  try {
    const all = await guild.members.fetch()
    m = all.find((mm) => {
      const u = mm.user
      return (u && u.username && u.username.toLowerCase() === q) || (mm.displayName && mm.displayName.toLowerCase() === q)
    }) || null
    return m || null
  } catch (_) {
    return null
  }
}

app.post('/webhook/pedido', (req, res) => {
  try {
    console.log('[webhook] pedido recibido', { body: req.body, hasSecret: !!req.headers['x-webhook-secret'] })
    pushEvent('pedido_recibido', { body: req.body })
    if (WEBHOOK_SECRET) {
      const header = req.headers['x-webhook-secret']
      if (!header || header !== WEBHOOK_SECRET) {
        console.error('[webhook] unauthorized: secreto incorrecto')
        pushEvent('unauthorized', { header })
        return res.status(401).json({ error: 'unauthorized' })
      }
    }
    const { discordUserId, discordUser, orderId, product, items, couponCode, couponPercent, totalFinal } = req.body || {}
    let resolvedId = extractUserId(discordUserId, discordUser)
    const safeOrderId = String(orderId || Date.now())
    const safeProduct = String(product || 'Pedido')
    res.status(202).json({ ok: true })
    ;(async () => {
      try {
        let guild = null
        let category = null
        if (GUILD_ID) {
          guild = client.guilds.cache.get(GUILD_ID) || (await client.guilds.fetch(GUILD_ID).catch(() => null))
          if (!guild) {
            console.error('[webhook] guild_not_found', { GUILD_ID })
            pushEvent('guild_not_found', { GUILD_ID })
            return
          }
          category = guild.channels.cache.get(CATEGORY_ID) || (await guild.channels.fetch(CATEGORY_ID).catch(() => null))
        } else {
          category = await client.channels.fetch(CATEGORY_ID).catch(() => null)
          guild = category?.guild || null
        }
        if (!category || category.type !== ChannelType.GuildCategory) {
          console.error('[webhook] category_not_found', { CATEGORY_ID })
           pushEvent('category_not_found', { CATEGORY_ID })
          return
        }
        const baseName = `ticket-${safeOrderId.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64)}`
        const channelName = baseName.length ? baseName : `ticket-${Date.now()}`
        let overwrites = [
          {
            id: guild.roles.everyone.id,
            type: OverwriteType.Role,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          ...STAFF_ROLE_IDS.map((rid) => ({
            id: rid,
            type: OverwriteType.Role,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          })),
          {
            id: client.user.id,
            type: OverwriteType.Member,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.CreateInstantInvite,
            ],
          },
        ]
        let member = null
        try {
          if (resolvedId) member = await guild.members.fetch(resolvedId).catch(() => null)
        } catch (_) {
          member = null
        }
        if (!member && discordUser && !resolvedId) {
          const byName = await findMemberByName(guild, discordUser)
          if (byName) {
            member = byName
            resolvedId = byName.id
            pushEvent('member_found_by_name', { userId: resolvedId, name: discordUser })
          } else {
            pushEvent('member_name_missing', { name: discordUser })
          }
        }
        if (member) {
          pushEvent('member_found', { userId: resolvedId })
          overwrites.push({
            id: resolvedId,
            type: OverwriteType.Member,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          })
        } else {
          pushEvent('member_missing', { userId: resolvedId || null })
        }
        const itemNames = Array.isArray(items) ? items.filter(Boolean).map((x) => String(x)) : []
        const productLabel = itemNames.length === 1 ? itemNames[0] : (itemNames.length > 1 ? `${itemNames.length} productos` : safeProduct)
        const channel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: CATEGORY_ID,
          permissionOverwrites: overwrites,
          reason: `Pedido ${safeOrderId} - ${productLabel}`,
        })
        console.log('[webhook] canal_creado', { channelId: channel.id, channelName, resolvedId })
        let inviteUrl = null
        try {
          const inv = await channel.createInvite({ maxAge: 1800, maxUses: 1, unique: true })
          if (inv && inv.code) inviteUrl = `https://discord.gg/${inv.code}`
        } catch (_) {}
        ticketStatus.set(safeOrderId, { channelId: channel.id, guildId: guild.id, url: inviteUrl || `https://discord.com/channels/${guild.id}/${channel.id}` })
        pushEvent('canal_creado', { orderId: safeOrderId, channelId: channel.id, channelName, resolvedId })
        const embed = new EmbedBuilder()
          .setColor(0x5bbf8a)
          .setTitle('Nuevo pedido')
          .setDescription('Tu ticket privado ha sido creado.')
          .addFields(
            { name: 'Pedido', value: String(safeOrderId), inline: true },
            { name: 'Producto', value: String(productLabel), inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Enderland • Tickets' })
        if (itemNames.length > 0) {
          const list = itemNames.slice(0, 15).map((n) => `• ${String(n)}`).join('\n')
          embed.addFields({ name: 'Productos', value: list, inline: false })
        }
        const totalNum = parseFloat(totalFinal || 0)
        const hasCoupon = couponCode && parseFloat(couponPercent || 0) > 0
        embed.addFields(
          { name: 'Total', value: `**$${(isNaN(totalNum) ? 0 : totalNum).toFixed(2)} USD**`, inline: true },
          { name: 'Cupón', value: hasCoupon ? `\`${String(couponCode)}\` (-${parseFloat(couponPercent).toFixed(0)}%)` : 'Ninguno', inline: true }
        )
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_close').setLabel('Cerrar ticket').setStyle(ButtonStyle.Danger)
        )
        const staffMentions = STAFF_ROLE_IDS.map((rid) => `<@&${rid}>`).join(' ')
        await channel.send({
          content: `Bienvenido <@${resolvedId}> • ${staffMentions}`,
          embeds: [embed],
          allowedMentions: { users: [resolvedId], roles: STAFF_ROLE_IDS },
          components: [row],
        })
        pushEvent('mensaje_enviado', { channelId: channel.id })
      } catch (err) {
        console.error('[webhook] internal_error_async', err)
        pushEvent('internal_error_async', { error: String(err && err.message || err) })
      }
    })()
  } catch (err) {
    console.error('[webhook] internal_error', err)
    pushEvent('internal_error', { error: String(err && err.message || err) })
    res.status(500).json({ error: 'internal_error' })
  }
})
client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isButton()) return
    if (interaction.customId !== 'ticket_close') return
    await interaction.reply({ content: 'Cerrando el ticket…', ephemeral: true })
    const ch = interaction.channel
    if (ch) {
      await ch.delete('Ticket cerrado')
      pushEvent('ticket_closed', { channelId: ch.id })
    }
  } catch (e) {
    pushEvent('ticket_close_error', { error: String(e && e.message || e) })
  }
})

client.once('clientReady', () => {
  console.log(`Bot listo como ${client.user.tag}`)
})

app.listen(PORT, () => {
  console.log(`Webhook escuchando en http://localhost:${PORT}`)
})

client.login(BOT_TOKEN)
