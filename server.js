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
    if (!DISCORD_WEBHOOK_URL) {
        console.error("❌ ERROR: DISCORD_WEBHOOK_URL is missing!");
        return;
    }

    try {
        const form = new FormData();
        
        // 1. ADDING A CONTENT STRING (This fixes the 'empty message' error)
        const payload = {
            content: "🔔 **New Order Alert!**", 
            embeds: [{
                title: "🍪 Dreamy Dough Receipt Submission",
                color: 0xB88A44, 
                fields: [
                    { name: "Order ID", value: orderData.orderId || "N/A", inline: true },
                    { name: "Total", value: `RM ${orderData.total || "0"}`, inline: true },
                    { name: "Items", value: orderData.items || "No items listed" }
                ],
                image: { url: 'attachment://receipt.png' },
                footer: { text: "Dreamy Dough Bakery Server" },
                timestamp: new Date()
            }]
        };

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
        console.log(`📡 Discord Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            console.log("✅ Discord notification sent successfully!");
        } else {
            console.error(`⚠️ Discord Error: ${responseText}`);
        }

    } catch (error) {
        console.error("❌ Connection Error:", error.message);
    }
}

app.post('/order/upload', upload.single('receipt'), async (req, res) => {
    const { orderId, total, items } = req.body;
    console.log(`📦 Processing Order: ${orderId}`);
    
    await notifyDiscord({ orderId, total, items }, req.file);
    res.status(200).json({ message: "Receipt processed!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bakery Server running on port ${PORT}`));