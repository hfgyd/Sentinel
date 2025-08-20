require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const { Telegraf } = require('telegraf');
const Report = require('./models/Report');

// === Setup ===
const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(helmet());

// === DB ===
mongoose.connect(process.env.MONGO_URI)
  .then(()=>console.log('✅ MongoDB connected'))
  .catch(err=>console.error('Mongo error', err));

// === Optional notifiers ===
let transporter = null;
if (process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}
const bot = process.env.TELEGRAM_BOT_TOKEN ? new Telegraf(process.env.TELEGRAM_BOT_TOKEN) : null;

// === Routes ===

// Receive encrypted bundle
app.post('/api/reports', async (req,res)=>{
  try {
    const rpt = new Report(req.body);
    await rpt.save();

    // Notify NGO
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.WATCHDOG_EMAIL,
        subject: "New Police Abuse Report",
        text: `New report received at ${rpt.createdAt}. Hash: ${rpt.manifestHash}`
      });
    }
    if (bot) {
      await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID,
        `⚠️ New Report @ ${rpt.createdAt}\nHash: ${rpt.manifestHash}`);
    }

    res.json({ message:"Report received", reportId:rpt._id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:"Failed to save report" });
  }
});

// Aggregated trends (just counts of reports per day)
app.get('/api/reports/trends', async (req,res)=>{
  const agg = await Report.aggregate([
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date:"$createdAt" } }, count:{ $sum:1 } } },
    { $sort: { _id:1 } }
  ]);
  res.json(agg);
});

// Time endpoint for client anchoring
app.get('/api/reports/__time',(req,res)=>{
  res.set('Content-Type','text/plain');
  res.send(new Date().toISOString());
});

// (Optional) Admin: list all reports
app.get('/api/reports', async (req,res)=>{
  const all = await Report.find().sort({ createdAt:-1 }).limit(50);
  res.json(all);
});

// === Start ===
const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>console.log(`🚀 Server listening on http://localhost:${PORT}`));
