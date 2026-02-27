const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');

// 1. Secret Webhook from Render Environment Variables
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const app = express();
app.use(cors());
app.use(express.json());

// Setup local storage (Temporary on Render)
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

// 2. DEBUGGED HELPER FUNCTION (Sends Text + Image)
async function notifyDiscord(orderData, fileData) {
    if (!DISCORD_WEBHOOK_URL) {
        console.error("❌ ERROR: DISCORD_WEBHOOK_URL is missing in Render Environment Variables!");
        return;
    }

    try {
        const form = new FormData();
        
        // Construct the Discord Embed
        const payload = {
            embeds: [{
                title: "🍪 New Order Received!",
                color: 0xB88A44, 
                fields: [
                    { name: "Order ID", value: orderData.orderId || "N/A", inline: true },
                    { name: "Total", value: `RM ${orderData.total || "0"}`, inline: true },
                    { name: "Items", value: orderData.items || "No items listed" }
                ],
                image: { url: 'attachment://receipt.png' },
                timestamp: new Date()
            }]
        };

        form.append('payload_json', JSON.stringify(payload));
        
        // Attach the actual receipt file
        if (fileData) {
            form.append('file', fs.createReadStream(fileData.path), 'receipt.png');
        }

        // Send to Discord and capture the response
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });

        const responseText = await response.text();
        
        // These logs will appear in your Render "Logs" tab
        console.log(`📡 Discord Status: ${response.status} ${response.statusText}`);
        console.log(`📡 Discord Response: ${responseText}`);

        if (response.ok) {
            console.log("✅ Discord notification sent successfully!");
        } else {
            console.error("⚠️ Discord rejected the notification. Check the status code above.");
        }

    } catch (error) {
        console.error("❌ Network or Code Error:", error.message);
    }
}

// 3. UPLOAD ROUTE
app.post('/order/upload', upload.single('receipt'), async (req, res) => {
    const { orderId, total, items } = req.body;
    
    console.log(`📦 Processing Order: ${orderId}`);
    
    // Pass order details AND the file to the notification function
    await notifyDiscord({ orderId, total, items }, req.file);

    res.status(200).json({ message: "Receipt received and processed!" });
});

// For Render, use process.env.PORT or 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bakery Server running on port ${PORT}`));