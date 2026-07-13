"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const filters_1 = require("telegraf/filters");
const dotenv_1 = __importDefault(require("dotenv"));
const openai_1 = __importDefault(require("openai"));
const node_cron_1 = __importDefault(require("node-cron"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const database_1 = require("./database");
const processor_1 = require("./knowledge/processor");
const port_1 = require("./port");
dotenv_1.default.config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!BOT_TOKEN || !GROQ_API_KEY) {
    throw new Error("Missing BOT_TOKEN or GROQ_API_KEY");
}
const bot = new telegraf_1.Telegraf(BOT_TOKEN);
const ai = new openai_1.default({
    apiKey: GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});
if (!fs_1.default.existsSync("uploads")) {
    fs_1.default.mkdirSync("uploads");
}
// ===============================
// START
// ===============================
bot.start((ctx) => {
    ctx.reply(`
Hello, I’m Redat 🤝

Redat means "Supporter".

I am your personal AI advisor designed to help, guide and support you.

You can ask questions, create tasks, save memories and upload documents.


---------------------------


ሰላም፣ እኔ Redat ነኝ 🤝

Redat ማለት "ደጋፊ" ማለት ነው።

እኔ የእርስዎ የግል AI አማካሪ ነኝ።

ጥያቄዎችን መጠየቅ፣ ማስታወሻዎችን ማስቀመጥ፣ ተግባሮችን ማቀድ እና ሰነዶችን መጫን ይችላሉ።


Use /help
`);
});
// ===============================
// HELP
// ===============================
bot.help((ctx) => {
    ctx.reply(`
🤖 Redat Commands


/profile
Show your information


/remember text
Save memory


/forget
Delete memory


/task text
Create task


/tasks
Show tasks


/done id
Complete task


/upload
Upload PDF


/help
Commands

`);
});
// ===============================
// PROFILE
// ===============================
bot.command("profile", (ctx) => {
    const user = (0, database_1.getUser)(ctx.from.id.toString());
    if (!user) {
        ctx.reply("No memory stored yet.");
        return;
    }
    ctx.reply(`
👤 Your Profile


Name:
${user.name || "Unknown"}


Memory:
${user.preferences || "None"}

`);
});
// ===============================
// REMEMBER
// ===============================
bot.command("remember", (ctx) => {
    const text = ctx.message.text
        .replace("/remember", "")
        .trim();
    if (!text) {
        ctx.reply("Example:\n/remember I like cybersecurity");
        return;
    }
    (0, database_1.updatePreferences)(ctx.from.id.toString(), text);
    ctx.reply(`✅ Remembered:\n${text}`);
});
// ===============================
// FORGET
// ===============================
bot.command("forget", (ctx) => {
    (0, database_1.clearMemory)(ctx.from.id.toString());
    ctx.reply("🧹 Memory deleted.");
});
// ===============================
// TASKS
// ===============================
bot.command("task", (ctx) => {
    const task = ctx.message.text
        .replace("/task", "")
        .trim();
    if (!task) {
        ctx.reply("Example:\n/task Study Python");
        return;
    }
    (0, database_1.addTask)(ctx.from.id.toString(), task);
    ctx.reply(`✅ Task created:\n${task}`);
});
bot.command("tasks", (ctx) => {
    const tasks = (0, database_1.getTasks)(ctx.from.id.toString());
    if (tasks.length === 0) {
        ctx.reply("No tasks.");
        return;
    }
    let msg = "📋 Tasks:\n\n";
    tasks.forEach((task, index) => {
        msg +=
            `
${index + 1}. ${task.task}

Status:
${task.status}

`;
    });
    ctx.reply(msg);
});
bot.command("done", (ctx) => {
    const id = Number(ctx.message.text
        .replace("/done", "")
        .trim());
    (0, database_1.completeTask)(id);
    ctx.reply("✅ Completed.");
});
// ===============================
// PDF UPLOAD
// ===============================
bot.command("upload", (ctx) => {
    ctx.reply("📚 Send me your PDF file.");
});
bot.on("document", async (ctx) => {
    try {
        const file = ctx.message.document;
        if (!file.file_name?.endsWith(".pdf")) {
            ctx.reply("Only PDF files are supported.");
            return;
        }
        const telegramFile = await ctx.telegram.getFile(file.file_id);
        const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${telegramFile.file_path}`;
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const path = `uploads/${file.file_name}`;
        fs_1.default.writeFileSync(path, Buffer.from(data));
        const text = await (0, processor_1.extractPDF)(path);
        (0, database_1.saveKnowledge)(ctx.from.id.toString(), file.file_name, text);
        ctx.reply(`
✅ PDF saved.

You can now ask questions about it.
`);
    }
    catch (error) {
        console.log(error);
        ctx.reply("PDF processing failed.");
    }
});
// ===============================
// REMINDER CHECK
// ===============================
node_cron_1.default.schedule("* * * * *", async () => {
    const reminders = (0, database_1.getPendingReminders)();
    for (const reminder of reminders) {
        await bot.telegram.sendMessage(reminder.telegram_id, `🔔 Reminder:\n${reminder.task}`);
        (0, database_1.completeTask)(reminder.id);
    }
});
// ===============================
// AI CHAT WITH MEMORY
// ===============================
bot.on((0, filters_1.message)("text"), async (ctx) => {
    const userId = ctx.from.id.toString();
    const question = ctx.message.text;
    try {
        await ctx.sendChatAction("typing");
        // Auto save name
        if (question.toLowerCase()
            .includes("my name is")) {
            const name = question
                .toLowerCase()
                .replace("my name is", "")
                .trim();
            (0, database_1.saveUser)(userId, name);
        }
        const user = (0, database_1.getUser)(userId);
        const history = (0, database_1.getConversationHistory)(userId, 10);
        let chats = "";
        history
            .reverse()
            .forEach(chat => {
            chats +=
                `
User:
${chat.user_message}

Redat:
${chat.bot_response}

`;
        });
        const docs = (0, database_1.searchKnowledge)(userId, question);
        let knowledge = "";
        docs
            .forEach(doc => {
            knowledge +=
                doc.content.substring(0, 2000);
        });
        const result = await ai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `
You are Redat.

You are a personal AI assistant.

User memory:

Name:
${user?.name || "Unknown"}

Preferences:
${user?.preferences || "None"}



Previous conversations:

${chats || "No previous chat"}



Documents:

${knowledge || "No documents"}





If user asks their name,
use memory.

Support English and Amharic.

`
                },
                {
                    role: "user",
                    content: question
                }
            ]
        });
        const answer = result
            .choices[0]
            .message
            .content || "";
        (0, database_1.saveConversation)(userId, question, answer);
        ctx.reply(answer);
    }
    catch (error) {
        console.error(error);
        ctx.reply("Sorry, Redat is unavailable.");
    }
});
// ===============================
// START BOT
// ===============================
const port = (0, port_1.getPort)();
const server = http_1.default.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Redat bot is running");
});
server.listen(port, () => {
    console.log(`🌐 Health server listening on port ${port}`);
});
bot.launch();
console.log("🤖 Redat is running");
const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down...`);
    await bot.stop(signal);
    server.close(() => process.exit(0));
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
