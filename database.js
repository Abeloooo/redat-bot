"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUser = getUser;
exports.saveUser = saveUser;
exports.updatePreferences = updatePreferences;
exports.clearMemory = clearMemory;
exports.saveConversation = saveConversation;
exports.getConversationHistory = getConversationHistory;
exports.addTask = addTask;
exports.getTasks = getTasks;
exports.completeTask = completeTask;
exports.getPendingReminders = getPendingReminders;
exports.saveKnowledge = saveKnowledge;
exports.searchKnowledge = searchKnowledge;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
// ===============================
// DATABASE CONNECTION
// ===============================
const db = new better_sqlite3_1.default("redat.db");
// ===============================
// TABLE CREATION
// ===============================
db.exec(`

CREATE TABLE IF NOT EXISTS users (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    telegram_id TEXT UNIQUE NOT NULL,

    name TEXT,

    preferences TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

`);
db.exec(`

CREATE TABLE IF NOT EXISTS conversations (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    telegram_id TEXT NOT NULL,

    user_message TEXT NOT NULL,

    bot_response TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

`);
db.exec(`

CREATE TABLE IF NOT EXISTS tasks (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    telegram_id TEXT NOT NULL,

    task TEXT NOT NULL,

    status TEXT DEFAULT 'pending',

    reminder_time DATETIME,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

`);
db.exec(`

CREATE TABLE IF NOT EXISTS knowledge (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    telegram_id TEXT NOT NULL,

    filename TEXT NOT NULL,

    content TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

`);
// ===============================
// USER MEMORY FUNCTIONS
// ===============================
function getUser(telegramId) {
    return db.prepare(`
        SELECT *

        FROM users

        WHERE telegram_id=?

        `)
        .get(telegramId);
}
function saveUser(telegramId, name) {
    const user = getUser(telegramId);
    if (user) {
        db.prepare(`
            UPDATE users

            SET name=?

            WHERE telegram_id=?

            `)
            .run(name, telegramId);
    }
    else {
        db.prepare(`
            INSERT INTO users

            (
                telegram_id,
                name
            )

            VALUES (?,?)

            `)
            .run(telegramId, name);
    }
}
function updatePreferences(telegramId, preference) {
    const user = getUser(telegramId);
    if (!user) {
        db.prepare(`
            INSERT INTO users

            (
                telegram_id,
                preferences
            )

            VALUES (?,?)

            `)
            .run(telegramId, preference);
        return;
    }
    const oldPreference = user.preferences || "";
    const updated = oldPreference
        ?
            `${oldPreference}, ${preference}`
        :
            preference;
    db.prepare(`
        UPDATE users

        SET preferences=?

        WHERE telegram_id=?

        `)
        .run(updated, telegramId);
}
function clearMemory(telegramId) {
    db.prepare(`
        UPDATE users

        SET

        name=NULL,

        preferences=NULL

        WHERE telegram_id=?

        `)
        .run(telegramId);
}
// ===============================
// CONVERSATION MEMORY
// ===============================
function saveConversation(telegramId, userMessage, botResponse) {
    db.prepare(`
        INSERT INTO conversations

        (

            telegram_id,

            user_message,

            bot_response

        )

        VALUES (?,?,?)

        `)
        .run(telegramId, userMessage, botResponse);
}
function getConversationHistory(telegramId, limit = 10) {
    return db.prepare(`
        SELECT *

        FROM conversations

        WHERE telegram_id=?

        ORDER BY id DESC

        LIMIT ?

        `)
        .all(telegramId, limit);
}
// ===============================
// TASK FUNCTIONS
// ===============================
function addTask(telegramId, task) {
    db.prepare(`
        INSERT INTO tasks

        (

            telegram_id,

            task

        )

        VALUES (?,?)

        `)
        .run(telegramId, task);
}
function getTasks(telegramId) {
    return db.prepare(`
        SELECT *

        FROM tasks

        WHERE telegram_id=?

        ORDER BY id DESC

        `)
        .all(telegramId);
}
function completeTask(id) {
    db.prepare(`
        UPDATE tasks

        SET status='completed'

        WHERE id=?

        `)
        .run(id);
}
function getPendingReminders() {
    return db.prepare(`
        SELECT *

        FROM tasks

        WHERE status='pending'

        AND reminder_time <= datetime('now')

        AND reminder_time IS NOT NULL

        `)
        .all();
}
// ===============================
// KNOWLEDGE BASE
// ===============================
function saveKnowledge(telegramId, filename, content) {
    db.prepare(`
        INSERT INTO knowledge

        (

            telegram_id,

            filename,

            content

        )

        VALUES (?,?,?)

        `)
        .run(telegramId, filename, content);
}
function searchKnowledge(telegramId, keyword) {
    return db.prepare(`
        SELECT *

        FROM knowledge

        WHERE telegram_id=?

        AND content LIKE ?

        `)
        .all(telegramId, `%${keyword}%`);
}
