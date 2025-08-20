const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  manifestHash: String,        // hash of manifest (tamper-evident)
  cipher: String,              // encrypted manifest
  iv: String,
  salt: String,
  wrapped: Object,             // optional wrapped key to server
  mediaDataURL: String,        // optional media (still base64)
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);
