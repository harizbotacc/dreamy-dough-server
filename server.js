const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/receipts';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

async function notifyDiscord(orderData, fileData) {
    if (!DISCORD_WEBHOOK_URL) return;

    try {
        const form = new FormData();
        
        // 1. We create a simple text string as a backup
        const messageContent = `🔔 **New Order Received!**\n**Order ID:** ${orderData.orderId}\n**Total:** RM ${orderData.total}`;

        // 2. We append the JSON as a string directly
        form.append('payload_json', JSON.stringify({
            content: messageContent, // Text fallback
            embeds: [{
                title: "🍪 Dreamy Dough Order Details",
                color: 0xB88A44, 
                fields: [
                    { name: "Order ID", value: orderData.orderId || "N/A", inline: true },
                    { name: "Total", value: `RM ${orderData.total || "0"}`, inline: true },
                    { name: "Items", value: orderData.items || "No items listed" }
                ],
                image: { url: 'attachment://receipt.png' },
                timestamp: new Date()
            }]
        }));
        
        // 3. Attach the file
        if (fileData) {
            form.append('file', fs.createReadStream(fileData.path), 'receipt.png');
        }

        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });

        const responseText = await response.text();
        console.log(`📡 Discord Status: ${response.status}`);
        
        if (response.ok) {
            console.log("✅ Message finally delivered to Discord!");
        } else {
            console.error(`⚠️ Discord still rejecting: ${responseText}`);
        }

    } catch (error) {
        console.error("❌ Connection Error:", error.message);
    }
}
        form.append('payload_json', JSON.stringify(payload));
        
        if (fileData) {
            form.append('file', fs.createReadStream(fileData.path), 'receipt.png');
        }

        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });

        const responseText = await response.text();
        console.log(`📡 Discord Status: ${response.status}`);
        
        if (response.ok) {
            console.log("✅ Success! Message sent to Discord.");
        } else {
            console.error(`⚠️ Discord Error: ${responseText}`);
        }

    } catch (error) {
        console.error("❌ Connection Error:", error.message);
    }
}

app.post('/order/upload', upload.single('receipt'), async (req, res) => {
    const { orderId, total, items } = req.body;
    console.log(`📦 Processing Receipt for: ${orderId}`);
    
    await notifyDiscord({ orderId, total, items }, req.file);
    res.status(200).json({ message: "Receipt submitted!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bakery Server active on port ${PORT}`));