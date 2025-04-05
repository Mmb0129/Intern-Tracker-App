const mongoose = require("mongoose");

const doubtSchema = new mongoose.Schema({
    regNo: String,
    question: String,
    answer: String,
    answeredAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Doubt", doubtSchema);
