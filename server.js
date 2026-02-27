const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data'); // Required for sending images to Discord

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

// 2. UPGRADED HELPER FUNCTION (Sends Text + Image)
async function notifyDiscord(orderData, fileData) {
    if (!DISCORD_WEBHOOK_URL) return;

    try {
        const form = new FormData();
        
        // Construct the Discord Embed
        const payload = {
            embeds: [{
                title: "🍪 New Order Received!",
                color: 0xB88A44, 
                fields: [
                    { name: "Order ID", value: orderData.orderId, inline: true },
                    { name: "Total", value: `RM ${orderData.total}`, inline: true },
                    { name: "Items", value: orderData.items }
                ],
                image: { url: 'attachment://receipt.png' }, // Links the attachment to the embed
                timestamp: new Date()
            }]
        };

        form.append('payload_json', JSON.stringify(payload));
        
        // Attach the actual receipt file
        if (fileData) {
            form.append('file', fs.createReadStream(fileData.path), 'receipt.png');
        }

        // Use a dynamic import for fetch if using older Node, or standard fetch for Node 18+
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        
        console.log("Discord notification sent!");
    } catch (error) {
        console.error("Discord notification failed:", error);
    }
}

// 3. UPDATED UPLOAD ROUTE
app.post('/order/upload', upload.single('receipt'), async (req, res) => {
    const { orderId, total, items } = req.body;
    
    // Pass order details AND the file to the notification function
    await notifyDiscord({ orderId, total, items }, req.file);

    res.status(200).json({ message: "Receipt received and Discord notified!" });
});

// For Render, use process.env.PORT or 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bakery Server running on port ${PORT}`));